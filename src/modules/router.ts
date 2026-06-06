// Page router with hash-based navigation
import { PubSub } from '../utils/pubsub';
import { cancelPendingRequests } from './data';

type PageClass = string;

export function showPage(pageClass: PageClass, title?: string): void {
  const pages = document.querySelectorAll('.page');
  pages.forEach(page => {
    if (page.classList.contains('show-page')) {
      page.classList.remove('show-page');
      PubSub.publish('onPageHidden', page.className);
    }
  });

  const target = document.querySelector(`.${pageClass}`) as HTMLElement | null;
  if (target) {
    target.classList.add('show-page');
  }

  if (title) {
    document.title = title;
  }
}

export function goHome(): void {
  showPage('page-home', 'Hacker News');
  PubSub.publish('load-home');
}

export function navigateTo(hash: string, state?: Record<string, unknown>): void {
  const url = `${window.location.pathname}${hash}`;
  window.history.pushState(state || {}, '', url);
  handleRoute();
}

export function goBack(): void {
  window.history.back();
}

function handleRoute(): void {
  cancelPendingRequests();
  const hash = window.location.hash;
  if (!hash || hash === '#/' || hash === '#') {
    goHome();
    return;
  }

  const parts = hash.substring(2).split('/'); // Remove #/
  const action = parts[0];
  const id = parts[1] ? Number(parts[1]) : undefined;

  if (action === 'comments' && id) {
    PubSub.publish('show-comments', id);
  } else if (action === 'article' && id) {
    PubSub.publish('show-article', id);
  } else if (action === 'settings') {
    PubSub.publish('show-settings');
  } else if (action === 'about') {
    PubSub.publish('show-about');
  } else if (action === 'performance') {
    PubSub.publish('show-performance');
  } else {
    goHome();
  }
}

export function initRouter(): void {
  window.addEventListener('popstate', handleRoute);

  // Handle initial route on page load
  if (window.location.hash) {
    handleRoute();
  }
}
