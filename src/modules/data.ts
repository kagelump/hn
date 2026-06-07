// Data module for fetching and caching HN data via Firebase API
import type { FirebaseItem, HNItem, HNComment, VisitedData, VisitedItem, LocalData } from '../types';
import { config } from '../config';
import { store } from '../utils/storage';
import { perf } from './performance';
import { escapeHtml } from '../utils/template';

const FIREBASE_BASE = config.url.stories;
const ALGOLIA_BASE = 'https://hn.algolia.com/api/v1';

let abortController: AbortController | null = null;

export function cancelPendingRequests(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

const STORY_ENDPOINTS: Record<string, string> = {
  fp: '/topstories.json',
  'new': '/newstories.json',
  ask: '/askstories.json',
  show: '/showstories.json',
  job: '/jobstories.json'
};

const MAX_CONCURRENT = 20;
const PAGE_SIZE = 30;
export const COMMENT_PAGE_SIZE = 30;
const visitedData: VisitedData = { version: 2 };
let localData: LocalData = { articles: {} };
let saveVisitedId: number | null = null;
let pendingIds: number[] = [];

function init(): void {
  readLocalData();
}

function resetCache(): void {
  localData = { articles: {} };
}

function timeAgo(unixTime: number): string {
  const seconds = Math.floor(Date.now() / 1000) - unixTime;
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function transformItem(fb: FirebaseItem): HNItem {
  const domain = fb.url ? extractDomain(fb.url) : '';
  return {
    id: fb.id,
    title: escapeHtml(fb.title || '[deleted]'),
    points: fb.score ?? 0,
    user: escapeHtml(fb.by || ''),
    time_ago: fb.time ? timeAgo(fb.time) : '',
    url: fb.url,
    domain,
    self: !fb.url,
    comments_count: fb.descendants ?? 0,
    text: fb.text,
    type: fb.type,
    kids: fb.kids
  };
}

interface AlgoliaItem {
  id: number;
  type: string;
  author?: string;
  title?: string;
  url?: string;
  text?: string;
  points?: number;
  num_comments?: number;
  children?: AlgoliaItem[];
  created_at_i?: number;
  story_id?: number;
}

function transformAlgoliaComment(item: AlgoliaItem): HNComment {
  const children = (item.children || [])
    .filter(c => c.type === 'comment')
    .map(transformAlgoliaComment);

  return {
    id: item.id,
    user: item.author || '[deleted]',
    time_ago: item.created_at_i ? timeAgo(item.created_at_i) : '',
    content: item.text || '',
    comments: children
  };
}

async function fetchAlgoliaItem(id: number, signal?: AbortSignal): Promise<AlgoliaItem> {
  return fetchJson<AlgoliaItem>(`${ALGOLIA_BASE}/items/${id}`, signal);
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

async function fetchItem(id: number, signal?: AbortSignal): Promise<FirebaseItem> {
  return fetchJson<FirebaseItem>(`${FIREBASE_BASE}/item/${id}.json`, signal);
}

async function fetchItems(ids: number[], signal?: AbortSignal): Promise<FirebaseItem[]> {
  const results: FirebaseItem[] = [];
  for (let i = 0; i < ids.length; i += MAX_CONCURRENT) {
    const batch = ids.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(batch.map(id => fetchItem(id, signal)));
    results.push(...batchResults);
  }
  return results;
}

function mergeVisitedState(items: HNItem[]): void {
  items.forEach(item => {
    const idStr = String(item.id);
    const visited = visitedData[idStr];
    item.visitedComments = '';
    item.visitedArticle = '';
    if (visited && typeof visited === 'object' && 'a' in visited) {
      if (visited.a) item.visitedArticle = 'visited';
      if (visited.c) item.visitedComments = 'visited';
    }
    if (item.type === 'job') {
      item.points = 'JOB';
    }
    localData.articles[item.id] = item;
  });
}

function readLocalData(): void {
  const t0 = Date.now();
  const localVisitedData = store.get<VisitedData>('visited');
  const localStorageList = store.get<{ data: HNItem[]; timestamp: number }>('list');

  perf.update('localstorage', 'read', Date.now() - t0);

  if (localVisitedData) {
    Object.assign(visitedData, localVisitedData);

    // Prune entries older than 7 days
    const sevenDaysMs = 1000 * 60 * 60 * 24 * 7;
    const now = Date.now();
    for (const key of Object.keys(visitedData)) {
      if (key === 'version') continue;
      const item = visitedData[key];
      if (item && typeof item === 'object' && 'a' in item) {
        if (item.a && item.a < now - sevenDaysMs) delete item.a;
        if (item.c && item.c < now - sevenDaysMs) delete item.c;
        if (!item.a && !item.c) delete visitedData[key];
      }
    }

    saveVisitedData();
  }

  if (localStorageList) {
    if (Date.now() - localStorageList.timestamp < 1000 * 60 * 5) {
      localData.list = localStorageList.data;
      mergeVisitedState(localData.list);
    }
  }
}

function saveVisitedDelayed(): void {
  saveVisitedId = null;
  store.set('visited', visitedData);
}

function saveVisitedData(): void {
  if (saveVisitedId) {
    window.clearTimeout(saveVisitedId);
    saveVisitedId = null;
  }
  saveVisitedId = window.setTimeout(saveVisitedDelayed, 1000);
}

function getVisitedItem(id: number): VisitedItem {
  const idStr = String(id);
  const existing = visitedData[idStr];

  if (!existing || typeof existing !== 'object' || !('a' in existing)) {
    const newItem: VisitedItem = {};
    visitedData[idStr] = newItem;
    return newItem;
  }

  return existing as VisitedItem;
}

function addVisited(id: number, type: 'a' | 'c'): void {
  const item = getVisitedItem(id);
  item[type] = Date.now();
  saveVisitedData();
}

async function fetchStoryIds(endpoint: string, signal?: AbortSignal): Promise<number[]> {
  const t0 = Date.now();
  const ids = await fetchJson<number[]>(`${FIREBASE_BASE}${endpoint}?t=${Date.now()}`, signal);
  perf.update('list', 'fetch', Date.now() - t0);
  return ids;
}

export async function getArticles(callback?: (data: HNItem[]) => void, reload = false): Promise<void> {
  if (!reload && localData.list) {
    if (callback) callback(localData.list);
    return;
  }

  try {
    cancelPendingRequests();
    abortController = new AbortController();
    const { signal } = abortController;

    resetCache();
    const allIds = await fetchStoryIds(STORY_ENDPOINTS.fp, signal);
    const firstPage = allIds.slice(0, PAGE_SIZE);
    pendingIds = allIds.slice(PAGE_SIZE);

    const rawItems = await fetchItems(firstPage, signal);
    const items = rawItems.filter(Boolean).map(transformItem);
    mergeVisitedState(items);

    localData.list = items;
    store.set('list', { data: items, timestamp: Date.now() });

    if (callback) callback(items);
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    console.error('Failed to fetch articles:', error);
    throw error;
  }
}

export async function loadMore(callback?: (data: HNItem[]) => void): Promise<void> {
  if (pendingIds.length === 0) return;

  try {
    const nextPage = pendingIds.splice(0, PAGE_SIZE);
    const rawItems = await fetchItems(nextPage);
    const items = rawItems.filter(Boolean).map(transformItem);
    mergeVisitedState(items);

    if (localData.list) {
      localData.list.push(...items);
    }

    if (callback && localData.list) callback(localData.list);
  } catch (error) {
    console.error('Failed to load more articles:', error);
    throw error;
  }
}

export async function getArticlesByType(
  type: string,
  callback?: (data: HNItem[]) => void,
  _reload = false
): Promise<void> {
  const endpoint = STORY_ENDPOINTS[type];
  if (!endpoint) {
    console.error(`Unknown story type: ${type}`);
    return;
  }

  try {
    cancelPendingRequests();
    abortController = new AbortController();
    const { signal } = abortController;

    const allIds = await fetchStoryIds(endpoint, signal);
    const firstPage = allIds.slice(0, PAGE_SIZE);
    pendingIds = allIds.slice(PAGE_SIZE);

    const rawItems = await fetchItems(firstPage, signal);
    const items = rawItems.filter(Boolean).map(transformItem);
    mergeVisitedState(items);

    localData.list = items;

    if (callback) callback(items);
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    console.error(`Failed to fetch ${type} articles:`, error);
    throw error;
  }
}

export async function getArticleMeta(id: number, callback?: (data: HNItem) => void): Promise<void> {
  const article = localData.articles[id];
  if (article && callback) {
    callback(article);
    return;
  }

  const t0 = Date.now();
  try {
    const raw = await fetchItem(id);
    perf.update(String(id), 'fetch', Date.now() - t0);

    const item = transformItem(raw);
    localData.articles[id] = item;

    if (callback) callback(item);
  } catch (error) {
    console.error('Failed to fetch article meta:', error);
    throw error;
  }
}

export async function getArticleComments(
  id: number,
  callback?: (data: HNItem) => void,
  reload = false
): Promise<void> {
  addVisited(id, 'c');

  const cached = localData.articles[id];
  if (!reload && cached?.comments && cached.commentsFetchTime &&
      cached.commentsFetchTime > (Date.now() - 1000 * 60 * 5)) {
    if (callback) callback(cached);
    return;
  }

  const t0 = Date.now();
  try {
    cancelPendingRequests();
    abortController = new AbortController();
    const { signal } = abortController;

    // Use Algolia API — returns the full comment tree in one request
    const algoliaItem = await fetchAlgoliaItem(id, signal);
    perf.update(String(id), 'comments-fetch', Date.now() - t0);

    // Build item from Algolia data (Algolia returns top-level fields differently)
    const domain = algoliaItem.url ? extractDomain(algoliaItem.url) : '';
    const item: HNItem = {
      id: algoliaItem.id,
      title: escapeHtml(algoliaItem.title || '[deleted]'),
      points: algoliaItem.points ?? 0,
      user: escapeHtml(algoliaItem.author || ''),
      time_ago: algoliaItem.created_at_i ? timeAgo(algoliaItem.created_at_i) : '',
      url: algoliaItem.url,
      domain,
      self: !algoliaItem.url,
      comments_count: algoliaItem.num_comments ?? 0,
      text: algoliaItem.text,
      type: algoliaItem.type,
      kids: []
    };

    // Transform all comments from the Algolia tree
    const allComments = (algoliaItem.children || [])
      .filter(c => c.type === 'comment')
      .map(transformAlgoliaComment);

    item.allKids = allComments.map(c => c.id);
    item.comments = allComments;
    item.fetchedKidsCount = allComments.length;
    item.allCommentsLoaded = true;
    item.commentsFetchTime = Date.now();

    localData.articles[id] = item;

    // Restore lastReadComment from visited data (if user has previously scrolled through)
    const visitItem = visitedData[String(id)];
    if (visitItem && typeof visitItem === 'object' && 'lastReadComment' in visitItem) {
      item.lastReadComment = (visitItem as VisitedItem).lastReadComment;
    }

    if (callback) callback(item);
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    console.error('Failed to fetch comments:', error);
    throw error;
  }
}

export async function loadMoreComments(
  _id: number,
  _callback?: (data: HNItem) => void
): Promise<void> {
  // No-op: Algolia API returns all comments in a single request
}

export function getLocalData(): LocalData {
  return localData;
}

// Initialize on load
init();

export const data = {
  getArticles,
  getArticlesByType,
  loadMore,
  getArticleMeta,
  getArticleComments,
  loadMoreComments,
  cache: getLocalData
};
