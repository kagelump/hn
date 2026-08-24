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
import {
  getRouteRevision,
  initRouter,
  isCurrentRoute,
  isRouteRevision,
  navigateTo,
  goBack,
  showPage
} from './modules/router';
import { initCommentsPage } from './modules/comments';
import { initArticlePage } from './modules/article';
import { initSettingsPage } from './modules/settings';
import { initAboutPage } from './modules/about';
import { initPerformancePage } from './modules/performance-page';
import { getBlockedUsers } from './modules/moderation';
import * as pullToRefresh from './modules/pullToRefresh';
import { setupSwipeGesture } from './modules/swipeBack';
import { initOtaUpdates } from './modules/otaUpdates';

// Add HTML class to show app
document.querySelector('html')?.classList.add('show-app');

// Initialize appearance settings from localStorage
const htmlNode = document.querySelector('html');
if (htmlNode) {
  // Theme (index.html defaults to theme-dark for first paint; reconcile with
  // any stored preference)
  const theme = store.get<string>('theme') || 'dark';
  htmlNode.classList.remove('theme-default', 'theme-dark');
  htmlNode.classList.add(`theme-${theme}`);
  htmlNode.setAttribute('data-theme', theme);

  // Font family
  const fontFamily = store.get<string>('fontFamily') || 'sf';
  const fontFamilyMap: Record<string, string> = {
    'source-sans': "'Source Sans Pro', Helvetica Neue, Segoe UI, Arial, sans-serif",
    'roboto-slab': "'Roboto Slab', Georgia, serif",
    'open-sans': "'Open Sans', Helvetica Neue, Segoe UI, Arial, sans-serif",
    'sf': "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"
  };
  if (fontFamilyMap[fontFamily]) {
    htmlNode.style.fontFamily = fontFamilyMap[fontFamily];
    htmlNode.setAttribute('data-font-family', fontFamily);
  }

  // Text size
  const textSize = store.get<number>('textSize') || 16;
  htmlNode.style.fontSize = `${textSize}px`;
  htmlNode.setAttribute('data-text-size', String(textSize));

  // Theme color
  const themeColor = store.get<string>('themeColor') || '#2196f3';
  htmlNode.style.setProperty('--theme-color', themeColor);
  htmlNode.setAttribute('data-theme-color', themeColor);

  // Text brightness
  const textBrightness = store.get<number>('textBrightness') ?? 100;
  htmlNode.style.setProperty('--text-brightness', `${textBrightness}`);

  // Animation
  const animation = store.get<string>('animation');
  if (animation === 'no') {
    htmlNode.classList.add('no-animation');
  }

  // Auto-hide read comments
  const hideReadComment = store.get<string>('hideReadComment') || 'yes';
  if (hideReadComment === 'yes') {
    htmlNode.classList.add('hide-comment-visited');
  }
}

// Delegated click handler
function setupClickHandlers(): void {
  document.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a') as HTMLAnchorElement | null;

    if (!link) return;

    const href = link.getAttribute('href') || '';

    // Back controls pop the in-app history stack and safely fall back to home
    // for direct/deep-link entries.
    if (link.classList.contains('back-home') || link.closest('.back-home')) {
      event.preventDefault();
      goBack();
      return;
    }

    // Handle hash-based navigation links
    if (href.startsWith('#/')) {
      event.preventDefault();
      navigateTo(href);
      return;
    }

    // Handle reload
    if (link.classList.contains('reload') || link.closest('.reload')) {
      event.preventDefault();
      loading.show();
      PubSub.publish('reload-home');
      return;
    }

    // Handle submenu items BEFORE toggle (items are inside .toggle-submenu)
    if (link.classList.contains('filter-fp')) {
      event.preventDefault();
      loading.show();
      PubSub.publish('load-home');
      closeSubmenu();
      return;
    }
    if (link.classList.contains('filter-ask-hn')) {
      event.preventDefault();
      loading.show();
      PubSub.publish('filter-home', 'ask');
      closeSubmenu();
      return;
    }
    if (link.classList.contains('filter-show-hn')) {
      event.preventDefault();
      loading.show();
      PubSub.publish('filter-home', 'show');
      closeSubmenu();
      return;
    }
    if (link.classList.contains('filter-today-top-10')) {
      event.preventDefault();
      loading.show();
      PubSub.publish('filter-home', 'todayTop10');
      closeSubmenu();
      return;
    }
    if (link.classList.contains('filter-yesterday-top-10')) {
      event.preventDefault();
      loading.show();
      PubSub.publish('filter-home', 'yesterdayTop10');
      closeSubmenu();
      return;
    }
    if (link.classList.contains('filter-week-top-10')) {
      event.preventDefault();
      loading.show();
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

// Initialize home page
function initHomePage(): void {
  const homePage = document.querySelector('.page-home');
  const homePageBody = homePage?.querySelector('.bd');

  if (!homePage || !homePageBody) {
    console.error('Home page elements not found');
    return;
  }

  const scrollContainer = homePage?.querySelector('.pagebd-container') as HTMLElement | null;
  if (scrollContainer) {
    pullToRefresh.init({
      container: scrollContainer,
      onRefresh: () => {
        PubSub.publish('reload-home');
      }
    });
  }

  const listItemTemplate = document.querySelector('.template-list-item')?.innerHTML || '';
  const listItemRender = prerender(listItemTemplate);

  let isLoadingMore = false;

  function renderList(items: Array<Record<string, unknown>>): void {
    const blocked = new Set(getBlockedUsers());
    const html = items.filter(item => !blocked.has(String(item.user))).map(item => {
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
    PubSub.publish('reload-home-complete');
  }

  function renderHomeIfCurrent(revision: number, items: Array<Record<string, unknown>>): void {
    if (!isRouteRevision(revision) || !isCurrentRoute('home')) return;
    renderList(items);
  }

  function appendList(items: Array<Record<string, unknown>>): void {
    const list = homePageBody!.querySelector('.list');
    if (!list) return;

    // Get existing IDs to avoid duplicates
    const existingIds = new Set<string>();
    list.querySelectorAll('li[data-id]').forEach(li => {
      existingIds.add(li.getAttribute('data-id') || '');
    });

    const blocked = new Set(getBlockedUsers());
    const newItems = items.filter(item =>
      item.id && !existingIds.has(String(item.id)) && !blocked.has(String(item.user)));
    const html = newItems.map(item => {
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

    list.insertAdjacentHTML('beforeend', html);
    isLoadingMore = false;
  }

  PubSub.subscribe('load-home', () => {
    const revision = getRouteRevision();
    showPage('page-home', 'Hacker News');
    data.getArticles((items) => {
      renderHomeIfCurrent(revision, items as unknown as Array<Record<string, unknown>>);
    }, true);
  });

  PubSub.subscribe('show-home', () => {
    const revision = getRouteRevision();
    showPage('page-home', 'Hacker News');
    if (!data.cache().list) {
      loading.show();
    }
    data.getArticles((items) => {
      renderHomeIfCurrent(revision, items as unknown as Array<Record<string, unknown>>);
    }, false);
  });

  PubSub.subscribe('reload-home', () => {
    const revision = getRouteRevision();
    data.getArticles((items) => {
      renderHomeIfCurrent(revision, items as unknown as Array<Record<string, unknown>>);
    }, true).catch((error) => {
      console.error('Failed to reload home:', error);
      loading.setStatus('Could not refresh stories');
      window.setTimeout(() => loading.clearStatus(), 3000);
      PubSub.publish('reload-home-error');
    });
  });

  PubSub.subscribe('filter-home', (type: unknown) => {
    const filterType = String(type);
    const revision = getRouteRevision();
    showPage('page-home', 'Hacker News');

    if (filterType === 'todayTop10' || filterType === 'yesterdayTop10' || filterType === 'weekTop10') {
      // These require date-based queries not supported by Firebase API directly
      // Fall back to top stories for now
      data.getArticles((items) => {
        renderHomeIfCurrent(revision, items as unknown as Array<Record<string, unknown>>);
      }, true);
    } else {
      data.getArticlesByType(filterType, (items) => {
        renderHomeIfCurrent(revision, items as unknown as Array<Record<string, unknown>>);
      });
    }
  });

  // Infinite scroll: load more when near bottom
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', () => {
      if (isLoadingMore) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      if (scrollHeight - scrollTop - clientHeight < 200 && data.hasMore()) {
        isLoadingMore = true;
        const list = homePageBody!.querySelector('.list');
        if (list) {
          list.insertAdjacentHTML('beforeend',
            '<li class="load-more-indicator"><div class="show-loading"><div class="circle"></div></div></li>'
          );
        }
        data.loadMore((items) => {
          // Remove loading indicator
          const indicator = homePageBody!.querySelector('.load-more-indicator');
          indicator?.remove();
          appendList(items as unknown as Array<Record<string, unknown>>);
        }).catch((error) => {
          const indicator = homePageBody!.querySelector('.load-more-indicator');
          indicator?.remove();
          isLoadingMore = false;
          console.error('Failed to load more stories:', error);
          loading.setStatus('Could not load more stories');
          window.setTimeout(() => loading.clearStatus(), 3000);
        });
      }
    });
  }
}

// Initialize the application
function init(): void {
  console.log('Initializing Hacker News Reader v' + config.v.app);

  // A route change replaces the global home-list loader with page-local loading
  // states, so an aborted list request can never leave a spinner over a detail page.
  PubSub.subscribe('route-changing', () => loading.hide());
  setupClickHandlers();
  setupSwipeGesture();
  initHomePage();
  initCommentsPage();
  initArticlePage();
  initSettingsPage();
  initAboutPage();
  initPerformancePage();
  // Register every route subscriber before processing the initial URL so native
  // deep links cannot publish into an empty event bus.
  initRouter();

  // Signal a successful boot to Capgo so a freshly-downloaded OTA bundle isn't
  // rolled back. No-op on web/dev. Runs last: reaching here means the app booted.
  initOtaUpdates();

  // iOS convention: tapping the status bar scrolls the view to the top
  // The native AppDelegate swizzles UIStatusBarManager and calls scrollTo via evaluateJavaScript

}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
