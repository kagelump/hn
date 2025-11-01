// Data module for fetching and caching HN data
import type { HNItem, HNComment, VisitedData, LocalData } from '../types';
import { config } from '../config';
import { store } from '../utils/storage';
import { template } from '../utils/template';
import { perf } from './performance';

const URL_TEMPLATES = {
  list: '/news',
  item: '/item/{id}',
  viewText: 'http://viewtext.org/api/text?url={url}&format={format}',
  AskHn: 'https://api.thriftdb.com/api.hnsearch.com/items/_search?limit=30&sortby=create_ts+desc&weights[username]=0.1&weights[text]=1&weights[type]=0&weights[domain]=2&weights[title]=1.2&weights[url]=1&boosts[fields][points]=0.07&boosts[functions][pow(2,div(div(ms(create_ts,NOW),3600000),72))]=200&q="Ask+hn"&filter[fields][type]=submission&facet[queries][]=username:Ask&facet[queries][]=username:hn',
  ShowHn: 'https://api.thriftdb.com/api.hnsearch.com/items/_search?limit=30&sortby=create_ts+desc&weights[username]=0.1&weights[text]=1&weights[type]=0&weights[domain]=2&weights[title]=1.2&weights[url]=1&boosts[fields][points]=0.07&boosts[functions][pow(2,div(div(ms(create_ts,NOW),3600000),72))]=200&q="show+hn"&filter[fields][type]=submission&facet[queries][]=username:show&facet[queries][]=username:hn',
  top10ByDate: 'https://api.thriftdb.com/api.hnsearch.com/items/_search?filter[fields][type][]=submission&sortby=points+desc&filter[fields][create_ts][]=[{startDate}+TO+{endDate}]&limit=10'
};

let primaryServer = config.url.stories;
let backupServer = config.url.storiesBackup || config.url.stories;
let currentServer = primaryServer;
let lastServerChangeTime: number | undefined;

const visitedData: VisitedData = { version: 2 };
let localData: LocalData = { articles: {} };
let saveVisitedId: number | null = null;

// Initialize
function init(): void {
  readLocalData();
}

function getUrl(type: string): string {
  if (type === 'list' || type === 'item') {
    return currentServer + URL_TEMPLATES[type as 'list' | 'item'];
  } else if (type === 'AskHn' || type === 'ShowHn') {
    return URL_TEMPLATES[type as 'AskHn' | 'ShowHn'];
  } else if (type === 'todayTop10' || type === 'yesterdayTop10' || type === 'weekTop10') {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    if (type === 'todayTop10') {
      endDate.setHours(24);
    } else if (type === 'yesterdayTop10') {
      startDate.setHours(-24);
    } else if (type === 'weekTop10') {
      startDate.setDate(startDate.getDate() - 7);
    }

    return template(URL_TEMPLATES.top10ByDate, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
  }
  return '';
}

function changeServer(): boolean {
  if (!lastServerChangeTime || lastServerChangeTime + (1000 * 60 * 20) < Date.now()) {
    lastServerChangeTime = Date.now();
    currentServer = (currentServer === primaryServer ? backupServer : primaryServer);
    return true;
  }
  return false;
}

function resetCache(): void {
  localData = { articles: {} };
}

function updateLocalData(): void {
  if (!localData.list) return;

  localData.list.forEach(item => {
    item.visitedComments = '';
    item.visitedArticle = '';
    
    const idStr = String(item.id);
    const visited = visitedData[idStr];
    if (visited && typeof visited === 'object' && 'a' in visited) {
      if (visited.a) item.visitedArticle = 'visited';
      if (visited.c) item.visitedComments = 'visited';
    }
    
    if (item.type === 'job') {
      item.points = 'JOB';
    }
    if (!item.user) {
      item.user = '';
    }
    item.title = item.title.replace('<', '&lt;');
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
    
    // Clean old visited data
    Object.keys(visitedData).forEach(key => {
      if (key !== 'version') {
        const item = visitedData[key];
        if (item && typeof item === 'object' && 'a' in item) {
          if (item.a && item.a < Date.now() - (1000 * 60 * 60 * 24 * 7)) {
            delete item.a;
          }
          if (item.c && item.c < Date.now() - (1000 * 60 * 60 * 24 * 7)) {
            delete item.c;
          }
          if (!item.a && !item.c) {
            delete visitedData[key];
          }
        }
      }
    });
    
    saveVisitedData();
  }

  if (localStorageList) {
    if (Date.now() - localStorageList.timestamp < 1000 * 60 * 5) {
      localData.list = localStorageList.data;
      updateLocalData();
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

function addVisited(id: number, type: 'a' | 'c'): void {
  const idStr = String(id);
  const item = visitedData[idStr];
  if (!item || typeof item !== 'object' || !('a' in item)) {
    visitedData[idStr] = {};
  }
  const visitItem = visitedData[idStr];
  if (visitItem && typeof visitItem === 'object' && 'a' in visitItem) {
    visitItem[type] = Date.now();
  }
  saveVisitedData();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

async function updateList(callback?: (data: HNItem[]) => void): Promise<void> {
  const t0 = Date.now();
  
  try {
    const data = await fetchJson<HNItem[]>(getUrl('list') + '?t=' + Date.now());
    resetCache();
    perf.update('list', 'fetch', Date.now() - t0);
    localData.list = data;
    updateLocalData();
    
    if (callback) {
      callback(localData.list);
    }
    
    store.set('list', { data: localData.list, timestamp: Date.now() });
  } catch (error) {
    console.error('Failed to fetch list:', error);
    if (changeServer()) {
      return updateList(callback);
    }
    throw error;
  }
}

export async function getArticles(callback?: (data: HNItem[]) => void, reload = false): Promise<void> {
  if (!reload && localData.list) {
    if (callback) {
      callback(localData.list);
    }
    return;
  }
  return updateList(callback);
}

export async function getArticleMeta(id: number, callback?: (data: HNItem) => void): Promise<void> {
  const article = localData.articles[id];
  if (article && callback) {
    callback(article);
    return;
  }

  const t0 = Date.now();
  try {
    const data = await fetchJson<HNItem>(template(getUrl('item'), { id }));
    perf.update(String(id), 'comments-fetch', Date.now() - t0);
    
    if (data.url && data.url.startsWith('item')) {
      delete data.url;
    }
    
    localData.articles[id] = data;
    
    if (callback) {
      callback(data);
    }
  } catch (error) {
    console.error('Failed to fetch article meta:', error);
    if (changeServer()) {
      return getArticleMeta(id, callback);
    }
    throw error;
  }
}

export async function getArticleComments(id: number, callback?: (data: HNItem) => void, reload = false): Promise<void> {
  addVisited(id, 'c');
  
  const article = localData.articles[id];
  if (!reload && article?.comments && article.commentsFetchTime && 
      article.commentsFetchTime < (Date.now() + (1000 * 60 * 5))) {
    if (callback) {
      callback(article);
    }
    return;
  }

  const t0 = Date.now();
  try {
    const data = await fetchJson<HNItem>(template(getUrl('item'), { id }));
    perf.update(String(id), 'comments-fetch', Date.now() - t0);
    
    const updatedArticle = localData.articles[id] = data;
    
    if (updatedArticle.url && updatedArticle.url.startsWith('item')) {
      delete updatedArticle.url;
    }
    
    if (visitedData[id] && typeof visitedData[id] === 'object' && visitedData[id]?.lastReadComment) {
      const visitItem = visitedData[id];
      if (visitItem && typeof visitItem === 'object' && 'lastReadComment' in visitItem) {
        updatedArticle.lastReadComment = visitItem.lastReadComment;
      }
    }
    
    updatedArticle.commentsFetchTime = Date.now();
    
    if (callback) {
      callback(updatedArticle);
    }
    
    // Update last read comment
    setTimeout(() => {
      const getLastCommentId = (comments?: HNComment[]): number | undefined => {
        if (!comments) return undefined;
        let lastId: number | undefined;
        comments.forEach(comment => {
          if (!lastId || comment.id > lastId) {
            lastId = comment.id;
          }
          const childId = getLastCommentId(comment.comments);
          if (childId && (!lastId || childId > lastId)) {
            lastId = childId;
          }
        });
        return lastId;
      };
      
      const lastId = getLastCommentId(updatedArticle.comments as HNComment[]);
      const idStr = String(id);
      if (lastId) {
        const item = visitedData[idStr];
        if (!item || typeof item !== 'object' || !('a' in item)) {
          visitedData[idStr] = {};
        }
        const visitItem = visitedData[idStr];
        if (visitItem && typeof visitItem === 'object' && 'lastReadComment' in visitItem) {
          visitItem.lastReadComment = lastId;
          saveVisitedData();
        }
      }
    }, 300);
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    if (changeServer()) {
      return getArticleComments(id, callback, reload);
    }
    throw error;
  }
}

export function getLocalData(): LocalData {
  return localData;
}

// Initialize on load
init();

export const data = {
  getArticles,
  getArticleMeta,
  getArticleComments,
  cache: getLocalData
};
