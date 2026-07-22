// Page router with hash-based navigation
import { PubSub } from '../utils/pubsub';
import { cancelPendingRequests } from './data';

type PageClass = string;
export type NavigationDirection = 'forward' | 'back' | 'none';
export type RouteAction = 'home' | 'comments' | 'article' | 'settings' | 'about' | 'performance';

interface Route {
  action: RouteAction;
  id?: number;
  hash: string;
}

interface HNHistoryState extends Record<string, unknown> {
  __hnIndex?: number;
  __hnRoute?: string;
  __hnPreviousRoute?: string;
}

const ROUTE_PAGE_CLASSES: Record<RouteAction, PageClass> = {
  home: 'page-home',
  comments: 'page-article-comments',
  article: 'page-article-content',
  settings: 'page-settings',
  about: 'page-about',
  performance: 'page-performance'
};

const pageTransitionCleanups = new WeakMap<HTMLElement, () => void>();
let historyIndex = 0;
let routeRevision = 0;
let navigationDirection: NavigationDirection = 'none';

function normalizeHash(hash: string): string {
  if (!hash || hash === '#' || hash === '#/') return '#/';
  if (hash.startsWith('#/')) return hash;
  return `#/${hash.replace(/^#?\/?/, '')}`;
}

function parseRoute(hash: string): Route | null {
  const normalized = normalizeHash(hash);
  if (normalized === '#/') return { action: 'home', hash: normalized };

  const parts = normalized.substring(2).split('/');
  const action = parts[0];
  const id = parts[1] ? Number(parts[1]) : undefined;
  const validId = typeof id === 'number' && Number.isSafeInteger(id) && id > 0;

  if (action === 'comments' && validId) return { action: 'comments', id, hash: normalized };
  if (action === 'article' && validId) return { action: 'article', id, hash: normalized };
  if (action === 'settings' && parts.length === 1) return { action: 'settings', hash: normalized };
  if (action === 'about' && parts.length === 1) return { action: 'about', hash: normalized };
  if (action === 'performance' && parts.length === 1) return { action: 'performance', hash: normalized };
  return null;
}

function routeUrl(hash: string): string {
  return `${window.location.pathname}${window.location.search}${hash}`;
}

function historyState(): HNHistoryState {
  const state = window.history.state;
  return state && typeof state === 'object' ? state as HNHistoryState : {};
}

function replaceCurrentRoute(hash: string, previousRoute?: string): void {
  const state = historyState();
  const nextState: HNHistoryState = {
    ...state,
    __hnIndex: historyIndex,
    __hnRoute: hash
  };
  if (previousRoute) {
    nextState.__hnPreviousRoute = previousRoute;
  } else {
    delete nextState.__hnPreviousRoute;
  }
  window.history.replaceState(nextState, '', routeUrl(hash));
}

function cancelPageTransition(page: HTMLElement): void {
  pageTransitionCleanups.get(page)?.();
}

function startPageTransitionCleanup(page: HTMLElement): void {
  let completed = false;
  let timeoutId = 0;

  const cleanup = () => {
    if (completed) return;
    completed = true;
    window.clearTimeout(timeoutId);
    page.removeEventListener('transitionend', onTransitionEnd);
    page.classList.remove('exit-left', 'exit-right');
    if (pageTransitionCleanups.get(page) === cleanup) {
      pageTransitionCleanups.delete(page);
    }
  };

  const onTransitionEnd = (event: TransitionEvent) => {
    if (event.target !== page) return;
    if (event.propertyName && !event.propertyName.includes('transform')) return;
    cleanup();
  };

  pageTransitionCleanups.set(page, cleanup);
  page.addEventListener('transitionend', onTransitionEnd);
  timeoutId = window.setTimeout(cleanup, 500);

  if (document.documentElement.classList.contains('no-animation')) {
    queueMicrotask(cleanup);
  }
}

export function showPage(
  pageClass: PageClass,
  title?: string,
  direction: NavigationDirection = navigationDirection
): void {
  const target = document.querySelector(`.${pageClass}`) as HTMLElement | null;
  if (!target) return;

  const pages = Array.from(document.querySelectorAll('.page')) as HTMLElement[];
  const activePages = pages.filter(page => page.classList.contains('show-page'));

  if (activePages.length === 1 && activePages[0] === target) {
    cancelPageTransition(target);
    target.classList.remove('exit-left', 'exit-right', 'swiping', 'swipe-settle');
    target.style.transform = '';
    target.style.webkitTransform = '';
    if (title) document.title = title;
    return;
  }

  activePages.forEach(page => {
    cancelPageTransition(page);
    page.classList.remove('show-page', 'swiping', 'swipe-settle');
    page.style.transform = '';
    page.style.webkitTransform = '';
    page.classList.add(direction === 'back' ? 'exit-right' : 'exit-left');
    startPageTransitionCleanup(page);
    PubSub.publish('onPageHidden', page.className);
  });

  // Recover deterministically if previous async work ever left more than one page active.
  pages.forEach(page => {
    if (page === target) return;
    page.classList.remove('show-page', 'swiping', 'swipe-settle');
  });

  cancelPageTransition(target);
  target.classList.remove('exit-left', 'exit-right', 'swiping', 'swipe-settle');
  target.style.transform = '';
  target.style.webkitTransform = '';
  target.classList.add('show-page');

  if (title) document.title = title;
}

export function getRouteRevision(): number {
  return routeRevision;
}

export function isRouteRevision(revision: number): boolean {
  return revision === routeRevision;
}

export function isCurrentRoute(action: RouteAction, id?: number): boolean {
  const route = parseRoute(window.location.hash);
  return route?.action === action && (id === undefined || route.id === id);
}

export function getBackPageClass(): PageClass {
  const previousRoute = historyState().__hnPreviousRoute;
  const route = previousRoute ? parseRoute(previousRoute) : null;
  return ROUTE_PAGE_CLASSES[route?.action || 'home'];
}

export function navigateTo(hash: string, state?: Record<string, unknown>): void {
  const normalized = normalizeHash(hash);
  const currentHash = normalizeHash(window.location.hash);

  if (normalized === currentHash) {
    handleRoute('none');
    return;
  }

  const currentStateIndex = historyState().__hnIndex;
  if (typeof currentStateIndex === 'number') historyIndex = currentStateIndex;
  historyIndex += 1;

  const nextState: HNHistoryState = {
    ...(state || {}),
    __hnIndex: historyIndex,
    __hnRoute: normalized,
    __hnPreviousRoute: currentHash
  };
  window.history.pushState(nextState, '', routeUrl(normalized));
  handleRoute('forward');
}

export function goHome(): void {
  replaceCurrentRoute('#/');
  handleRoute('back');
}

export function goBack(): boolean {
  const stateIndex = historyState().__hnIndex;
  if (typeof stateIndex === 'number') historyIndex = stateIndex;

  if (historyIndex > 0) {
    window.history.back();
    return true;
  }

  goHome();
  return false;
}

function publishRoute(route: Route): void {
  if (route.action === 'home') {
    PubSub.publish('show-home');
  } else if (route.action === 'comments') {
    PubSub.publish('show-comments', route.id);
  } else if (route.action === 'article') {
    PubSub.publish('show-article', route.id);
  } else if (route.action === 'settings') {
    PubSub.publish('show-settings');
  } else if (route.action === 'about') {
    PubSub.publish('show-about');
  } else if (route.action === 'performance') {
    PubSub.publish('show-performance');
  }
}

function handleRoute(direction: NavigationDirection): void {
  PubSub.publish('route-changing');
  cancelPendingRequests();
  navigationDirection = direction;
  routeRevision += 1;

  let route = parseRoute(window.location.hash);
  if (!route) {
    replaceCurrentRoute('#/');
    route = { action: 'home', hash: '#/' };
  }

  publishRoute(route);
  PubSub.publish('route-changed', route.action, route.id, routeRevision);
}

function handlePopState(event: PopStateEvent): void {
  const nextState = event.state && typeof event.state === 'object'
    ? event.state as HNHistoryState
    : {};
  const nextIndex = typeof nextState.__hnIndex === 'number'
    ? nextState.__hnIndex
    : Math.max(0, historyIndex - 1);
  const direction: NavigationDirection = nextIndex < historyIndex ? 'back' : 'forward';
  historyIndex = nextIndex;
  handleRoute(direction);
}

export function initRouter(): () => void {
  const normalized = normalizeHash(window.location.hash);
  const state = historyState();
  historyIndex = typeof state.__hnIndex === 'number' ? state.__hnIndex : 0;
  replaceCurrentRoute(normalized, state.__hnPreviousRoute);

  window.addEventListener('popstate', handlePopState);
  handleRoute('none');

  return () => window.removeEventListener('popstate', handlePopState);
}
