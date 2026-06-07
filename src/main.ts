// Main application entry point
import './styles/glyph.css';
import './styles/normalize.css';
import './styles/common.css';
import './styles/pages.css';
import './styles/dark.css';

import { config } from './config';
import { PubSub } from './utils/pubsub';
import { prerender } from './utils/template';
import { data } from './modules/data';
import { loading } from './modules/ui';
import { store } from './utils/storage';
import { initRouter, goHome, navigateTo, goBack, showPage } from './modules/router';
import { initCommentsPage } from './modules/comments';
import { initArticlePage } from './modules/article';
import { initSettingsPage } from './modules/settings';
import { initAboutPage } from './modules/about';
import { initPerformancePage } from './modules/performance-page';

// Add HTML class to show app
document.querySelector('html')?.classList.add('show-app');

// Initialize theme from localStorage
const theme = store.get<string>('theme') || 'default';
const fontSize = store.get<string>('fontsize') || 'normal';
const htmlNode = document.querySelector('html');
if (htmlNode) {
  htmlNode.classList.add(`theme-${theme}`, `font-${fontSize}`);
  htmlNode.setAttribute('data-theme', theme);
  htmlNode.setAttribute('data-font-size', fontSize);
}

// Auto-hide read comments
const hideReadComment = store.get<string>('hideReadComment') || 'yes';
if (hideReadComment === 'yes' && htmlNode) {
  htmlNode.classList.add('hide-comment-visited');
}

// Delegated click handler
function setupClickHandlers(): void {
  document.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a') as HTMLAnchorElement | null;

    if (!link) return;

    const href = link.getAttribute('href') || '';

    // Handle hash-based navigation links
    if (href.startsWith('#/')) {
      event.preventDefault();
      navigateTo(href);
      return;
    }

    // Handle back-home links
    if (link.classList.contains('back-home') || link.closest('.back-home')) {
      event.preventDefault();
      goHome();
      return;
    }

    // Handle reload
    if (link.classList.contains('reload') || link.closest('.reload')) {
      event.preventDefault();
      loading.show(event.clientX, event.clientY);
      PubSub.publish('reload-home');
      return;
    }

    // Handle submenu items BEFORE toggle (items are inside .toggle-submenu)
    if (link.classList.contains('filter-fp')) {
      event.preventDefault();
      loading.show(event.clientX, event.clientY);
      PubSub.publish('load-home');
      closeSubmenu();
      return;
    }
    if (link.classList.contains('filter-ask-hn')) {
      event.preventDefault();
      loading.show(event.clientX, event.clientY);
      PubSub.publish('filter-home', 'ask');
      closeSubmenu();
      return;
    }
    if (link.classList.contains('filter-show-hn')) {
      event.preventDefault();
      loading.show(event.clientX, event.clientY);
      PubSub.publish('filter-home', 'show');
      closeSubmenu();
      return;
    }
    if (link.classList.contains('filter-today-top-10')) {
      event.preventDefault();
      loading.show(event.clientX, event.clientY);
      PubSub.publish('filter-home', 'todayTop10');
      closeSubmenu();
      return;
    }
    if (link.classList.contains('filter-yesterday-top-10')) {
      event.preventDefault();
      loading.show(event.clientX, event.clientY);
      PubSub.publish('filter-home', 'yesterdayTop10');
      closeSubmenu();
      return;
    }
    if (link.classList.contains('filter-week-top-10')) {
      event.preventDefault();
      loading.show(event.clientX, event.clientY);
      PubSub.publish('filter-home', 'weekTop10');
      closeSubmenu();
      return;
    }
    if (link.classList.contains('show-settings')) {
      event.preventDefault();
      navigateTo('#/settings');
      closeSubmenu();
      return;
    }
    if (link.classList.contains('show-performance')) {
      event.preventDefault();
      navigateTo('#/performance');
      closeSubmenu();
      return;
    }

    // Handle submenu toggle (AFTER submenu items)
    if (link.classList.contains('toggle-submenu') || link.closest('.toggle-submenu')) {
      event.preventDefault();
      const submenuParent = document.querySelector('.submenu')?.parentElement;
      submenuParent?.classList.toggle('show-submenu');
      return;
    }
  });
}

function closeSubmenu(): void {
  document.querySelector('.submenu')?.parentElement?.classList.remove('show-submenu');
}

// Swipe-to-go-back gesture
function setupSwipeGesture(): void {
  let startX = 0;
  let startY = 0;
  const SWIPE_THRESHOLD = 50;

  document.addEventListener('touchstart', (e: TouchEvent) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e: TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - startX;
    const deltaY = Math.abs(endY - startY);

    // Only trigger if: horizontal swipe, left-to-right, significant distance, not on home page
    if (deltaX > SWIPE_THRESHOLD && deltaY < 80 && startX < 30) {
      const homePage = document.querySelector('.page-home');
      if (homePage && !homePage.classList.contains('show-page')) {
        goBack();
      }
    }
  }, { passive: true });
}

// Initialize home page
function initHomePage(): void {
  const homePage = document.querySelector('.page-home');
  const homePageBody = homePage?.querySelector('.bd');

  if (!homePage || !homePageBody) {
    console.error('Home page elements not found');
    return;
  }

  const listItemTemplate = document.querySelector('.template-list-item')?.innerHTML || '';
  const listItemRender = prerender(listItemTemplate);

  function renderList(items: Array<Record<string, unknown>>): void {
    const html = items.map(item => {
      if (item.domain && item.url) {
        item.self = false;
        item.urlTitle = (item.url as string).replace(/^https?:\/\//, '');
      } else {
        item.self = true;
        item.urlTitle = '';
      }
      item.text = item.text || '';
      return item.id ? listItemRender(item) : '';
    }).join('');

    loading.hide();
    homePageBody!.innerHTML = `<ul class="list">${html}</ul>`;
    homePage!.classList.add('show-page');
  }

  PubSub.subscribe('load-home', () => {
    showPage('page-home', 'Hacker News');
    data.getArticles((items) => {
      renderList(items as unknown as Array<Record<string, unknown>>);
    }, true);
  });

  PubSub.subscribe('reload-home', () => {
    data.getArticles((items) => {
      renderList(items as unknown as Array<Record<string, unknown>>);
    }, true);
  });

  PubSub.subscribe('filter-home', (type: unknown) => {
    const filterType = String(type);
    showPage('page-home', 'Hacker News');

    if (filterType === 'todayTop10' || filterType === 'yesterdayTop10' || filterType === 'weekTop10') {
      // These require date-based queries not supported by Firebase API directly
      // Fall back to top stories for now
      data.getArticles((items) => {
        renderList(items as unknown as Array<Record<string, unknown>>);
      }, true);
    } else {
      data.getArticlesByType(filterType, (items) => {
        renderList(items as unknown as Array<Record<string, unknown>>);
      });
    }
  });
}

// Initialize the application
function init(): void {
  console.log('Initializing Hacker News Reader v' + config.v.app);

  setupClickHandlers();
  setupSwipeGesture();
  initHomePage();
  initRouter();
  initCommentsPage();
  initArticlePage();
  initSettingsPage();
  initAboutPage();
  initPerformancePage();

  // Load home page on start
  setTimeout(() => {
    if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
      PubSub.publish('load-home');
    }
  }, 100);
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
