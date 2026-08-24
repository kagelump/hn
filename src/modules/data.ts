// Data module for fetching and caching HN data via Firebase API
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { FirebaseItem, HNItem, HNComment, VisitedData, VisitedItem, LocalData } from '../types';
import { config } from '../config';
import { store } from '../utils/storage';
import { perf } from './performance';
import { escapeHtml } from '../utils/template';
import { loading } from './ui';

const FIREBASE_BASE = config.url.stories;
const ALGOLIA_BASE = 'https://hn.algolia.com/api/v1';
const HN_ITEM_URL = 'https://news.ycombinator.com/item';
const DEFAULT_CORS_PROXY = 'https://api.allorigins.win/raw?url=';

let abortController: AbortController | null = null;

export function cancelPendingRequests(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

export function hasMore(): boolean {
  return pendingIds.length > 0;
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

function getCorsProxyUrl(): string {
  return store.get<string>('corsProxy') || DEFAULT_CORS_PROXY;
}

async function fetchHnPageHtml(id: number, signal?: AbortSignal): Promise<string> {
  const url = `${HN_ITEM_URL}?id=${id}`;

  // On native platforms, use CapacitorHttp (no CORS needed)
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await CapacitorHttp.get({ url, responseType: 'text' });
      const html = result.data as string;
      if (html) {
        return html;
      }
    } catch (err) {
      console.warn('[HN Page] Native fetch failed, falling back to CORS proxy:', err);
    }
  }

  // Web fallback: use CORS proxy
  const proxy = getCorsProxyUrl();
  const proxyUrl = proxy + encodeURIComponent(url);
  const response = await fetch(proxyUrl, { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch HN page: ${response.status}`);
  }
  return response.text();
}

interface HnPageData {
  orderedIds: number[];
  colorClasses: Map<number, string>;
}

export function extractHnPageData(html: string, storyId: number): HnPageData {
  const orderedIds: number[] = [];
  const colorClasses = new Map<number, string>();

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Select all comment rows (tr.athing with an id that isn't the story itself)
    const rows = doc.querySelectorAll('tr.athing[id]');

    for (const row of rows) {
      const id = Number(row.id);
      if (!id || id === storyId) continue;

      orderedIds.push(id);

      // Find the commtext div inside this row to get the color class
      const commtext = row.querySelector('.commtext');
      if (commtext) {
        const classList = commtext.className.split(/\s+/);
        const colorClass = classList.find(c => /^c[a-fA-F0-9]{2}$/.test(c));
        if (colorClass) {
          colorClasses.set(id, colorClass);
        }
      }
    }
  } catch {
    // DOMParser threw — fall through to regex below
  }

  // Fallback to regex if DOMParser found nothing (e.g. bare <tr> without <table> wrapper)
  if (orderedIds.length === 0) {
    const idRegex = /<tr[^>]*\sid="(\d+)"[^>]*>/g;
    let match: RegExpExecArray | null;
    while ((match = idRegex.exec(html)) !== null) {
      const id = Number(match[1]);
      if (id !== storyId) {
        orderedIds.push(id);
      }
    }
  }

  return { orderedIds, colorClasses };
}

// Build a nested comment tree directly from the HN HTML page. Used as a fallback
// when Algolia can't supply the comment tree. The HN page only renders the "top"
// comments (large threads are truncated), so this returns a partial tree.
export function extractHnComments(html: string, storyId: number): HNComment[] {
  const roots: HNComment[] = [];

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return roots;
  }

  const rows = doc.querySelectorAll('tr.comtr[id], tr.athing.comtr[id]');

  // Stack of ancestors keyed by their indent depth. A row at indent d nests under
  // the most recent row with a smaller indent.
  const stack: { indent: number; node: HNComment }[] = [];

  for (const row of rows) {
    const id = Number(row.id);
    if (!id || id === storyId) continue;

    const indentCell = row.querySelector('td.ind');
    const indent = indentCell ? Number(indentCell.getAttribute('indent')) || 0 : 0;

    const commtext = row.querySelector('.commtext');
    const userEl = row.querySelector('.hnuser');
    const ageEl = row.querySelector('.age');

    let colorClass: string | undefined;
    if (commtext) {
      const cls = commtext.className.split(/\s+/).find(c => /^c[a-fA-F0-9]{2}$/.test(c));
      if (cls && cls !== 'c00') colorClass = cls;
    }

    const node: HNComment = {
      id,
      user: userEl?.textContent?.trim() || '[deleted]',
      time_ago: ageEl?.textContent?.trim() || '',
      content: commtext ? commtext.innerHTML : (row.querySelector('.comment')?.textContent?.trim() || ''),
      comments: []
    };
    if (colorClass) node.colorClass = colorClass;

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.comments!.push(node);
    }

    stack.push({ indent, node });
  }

  return roots;
}

export function applyColorClasses(comments: HNComment[], colorClasses: Map<number, string>): void {
  for (const comment of comments) {
    const colorClass = colorClasses.get(comment.id);
    if (colorClass && colorClass !== 'c00') {
      // c00 is the default black — no need to store it
      comment.colorClass = colorClass;
    }
    if (comment.comments && comment.comments.length > 0) {
      applyColorClasses(comment.comments, colorClasses);
    }
  }
}

export function sortCommentsByPageOrder(comments: HNComment[], orderedIds: number[]): HNComment[] {
  // Build position map from the scraped HTML order
  const position = new Map<number, number>();
  orderedIds.forEach((id, i) => position.set(id, i));

  function sortLevel(items: HNComment[]): HNComment[] {
    // Sort by page position; IDs not in the page fall to the end (preserving Algolia order via stable sort)
    const sorted = [...items].sort((a, b) => {
      const posA = position.get(a.id) ?? Infinity;
      const posB = position.get(b.id) ?? Infinity;
      return posA - posB;
    });
    // Recursively sort children
    for (const item of sorted) {
      if (item.comments && item.comments.length > 0) {
        item.comments = sortLevel(item.comments);
      }
    }
    return sorted;
  }

  return sortLevel(comments);
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

export function readLocalData(): void {
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
    loading.setStatus('Fetching story list…');
    const allIds = await fetchStoryIds(STORY_ENDPOINTS.fp, signal);
    const firstPage = allIds.slice(0, PAGE_SIZE);
    pendingIds = allIds.slice(PAGE_SIZE);

    loading.setStatus(`Loading stories 1–${firstPage.length} of ${allIds.length}…`);
    const rawItems = await fetchItems(firstPage, signal);
    const items = rawItems.filter(Boolean).map(transformItem);
    mergeVisitedState(items);

    localData.list = items;
    store.set('list', { data: items, timestamp: Date.now() });

    loading.clearStatus();
    if (callback) callback(items);
  } catch (error) {
    loading.clearStatus();
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

    loading.setStatus('Fetching story list…');
    const allIds = await fetchStoryIds(endpoint, signal);
    const firstPage = allIds.slice(0, PAGE_SIZE);
    pendingIds = allIds.slice(PAGE_SIZE);

    loading.setStatus(`Loading stories 1–${firstPage.length} of ${allIds.length}…`);
    const rawItems = await fetchItems(firstPage, signal);
    const items = rawItems.filter(Boolean).map(transformItem);
    mergeVisitedState(items);

    localData.list = items;

    loading.clearStatus();
    if (callback) callback(items);
  } catch (error) {
    loading.clearStatus();
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
    cancelPendingRequests();
    abortController = new AbortController();
    const raw = await fetchItem(id, abortController.signal);
    perf.update(String(id), 'fetch', Date.now() - t0);

    const item = transformItem(raw);
    localData.articles[id] = item;

    if (callback) callback(item);
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
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

    // Fetch Algolia (full comment tree) and HN HTML page (correct ordering) in parallel.
    // Both are non-fatal: when Algolia is unavailable we fall back to the HN HTML page.
    const [algoliaItem, hnHtmlResult] = await Promise.all([
      fetchAlgoliaItem(id, signal).catch((err): AlgoliaItem | null => {
        console.warn('Algolia fetch failed, will try HN page fallback:', err);
        return null;
      }),
      fetchHnPageHtml(id, signal).catch((err): string => {
        console.warn('Failed to fetch HN page for comment ordering:', err);
        return '';
      })
    ]);
    perf.update(String(id), 'comments-fetch', Date.now() - t0);

    // Transform all comments from the Algolia tree (empty when Algolia is unavailable).
    // Algolia's num_comments is often null, so derive count from children.
    let allComments = algoliaItem
      ? (algoliaItem.children || []).filter(c => c.type === 'comment').map(transformAlgoliaComment)
      : [];

    let sortWarning: string | undefined;

    if (allComments.length > 0) {
      // Normal path: order + color the Algolia tree using the HN HTML page.
      if (hnHtmlResult) {
        const pageData = extractHnPageData(hnHtmlResult, id);
        if (pageData.orderedIds.length > 0) {
          allComments = sortCommentsByPageOrder(allComments, pageData.orderedIds);
          applyColorClasses(allComments, pageData.colorClasses);
        }
      } else {
        sortWarning = 'Could not fetch the HN page to determine comment ordering. Comments are shown in default order.';
      }
    } else {
      // Algolia gave us no comments — build the tree directly from the HN HTML page.
      // The HN page only renders the top comments of large threads, hence the warning.
      const htmlComments = hnHtmlResult ? extractHnComments(hnHtmlResult, id) : [];
      if (htmlComments.length > 0) {
        allComments = htmlComments;
        sortWarning = 'Algolia is down — showing top comments only.';
      } else if (!algoliaItem) {
        // Both sources failed to yield anything — surface the error.
        // (When Algolia succeeded with no comments, this is a genuine empty thread.)
        throw new Error('Failed to load comments from Algolia and HN page');
      }
    }

    // Resolve story metadata. Prefer Algolia; when it's absent, fetch it from Firebase
    // (which is up). Raw, unescaped values here — escaped once at item construction.
    let metaTitle = '';
    let metaPoints = 0;
    let metaUser = '';
    let metaTimeAgo = '';
    let metaUrl: string | undefined;
    let metaText: string | undefined;
    let metaType: string | undefined;
    let commentsCount = allComments.length;

    if (algoliaItem) {
      metaTitle = algoliaItem.title || '';
      metaPoints = algoliaItem.points ?? 0;
      metaUser = algoliaItem.author || '';
      metaTimeAgo = algoliaItem.created_at_i ? timeAgo(algoliaItem.created_at_i) : '';
      metaUrl = algoliaItem.url;
      metaText = algoliaItem.text;
      metaType = algoliaItem.type;
    } else {
      const raw = await fetchItem(id, signal).catch((): FirebaseItem | null => null);
      if (raw) {
        metaTitle = raw.title || '';
        metaPoints = raw.score ?? 0;
        metaUser = raw.by || '';
        metaTimeAgo = raw.time ? timeAgo(raw.time) : '';
        metaUrl = raw.url;
        metaText = raw.text;
        metaType = raw.type;
        if (typeof raw.descendants === 'number') commentsCount = raw.descendants;
      }
    }

    const domain = metaUrl ? extractDomain(metaUrl) : '';

    const item: HNItem = {
      id,
      title: escapeHtml(metaTitle || '[deleted]'),
      points: metaPoints,
      user: escapeHtml(metaUser),
      time_ago: metaTimeAgo,
      url: metaUrl,
      domain,
      self: !metaUrl,
      comments_count: commentsCount,
      text: metaText,
      type: metaType,
      kids: [],
      sortWarning
    };

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

export function getArticleById(id: number): HNItem | undefined {
  return localData.articles[id];
}

// Initialize on load
init();

export const data = {
  getArticles,
  getArticlesByType,
  loadMore,
  hasMore,
  getArticleMeta,
  getArticleComments,
  loadMoreComments,
  getArticleById,
  cache: getLocalData
};
