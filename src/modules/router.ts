// Page router with hash-based navigation
import { PubSub } from '../utils/pubsub';
import { cancelPendingRequests } from './data';

type PageClass = string;

export function showPage(pageClass: PageClass, title?: string): void {
  const pages = document.querySelectorAll('.page');
  const incomingIsHome = pageClass === 'page-home';

  pages.forEach(page => {
    if (page.classList.contains('show-page')) {
      const isBack = incomingIsHome;
      page.classList.remove('show-page');
      // Clear any inline transforms (e.g. from swipe gesture) so CSS classes take effect
      (page as HTMLElement).style.transform = '';
      (page as HTMLElement).style.webkitTransform = '';
      page.classList.add(isBack ? 'exit-right' : 'exit-left');
      const el = page as HTMLElement;
      const cleanup = () => {
        el.classList.remove('exit-left', 'exit-right');
        el.removeEventListener('transitionend', cleanup);
      };
      el.addEventListener('transitionend', cleanup, { once: true });
      setTimeout(() => el.classList.remove('exit-left', 'exit-right'), 500);
      PubSub.publish('onPageHidden', page.className);
    }
  });

  const target = document.querySelector(`.${pageClass}`) as HTMLElement | null;
  if (target) {
    target.classList.remove('exit-left', 'exit-right');
    target.classList.add('show-page');
  }

  if (title) {
    document.title = title;
  }
}

export function goHome(): void {
  showPage('page-home', 'Hacker News');
  PubSub.publish('show-home');
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
