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
import * as pullToRefresh from './modules/pullToRefresh';

// Add HTML class to show app
document.querySelector('html')?.classList.add('show-app');

// Initialize appearance settings from localStorage
const htmlNode = document.querySelector('html');
if (htmlNode) {
  // Theme
  const theme = store.get<string>('theme') || 'default';
  htmlNode.classList.add(`theme-${theme}`);
  htmlNode.setAttribute('data-theme', theme);

  // Font family
  const fontFamily = store.get<string>('fontFamily') || 'source-sans';
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
  const textSize = store.get<number>('textSize');
  if (textSize) {
    htmlNode.style.fontSize = `${textSize}px`;
    htmlNode.setAttribute('data-text-size', String(textSize));
  }

  // Theme color
  const themeColor = store.get<string>('themeColor');
  if (themeColor) {
    htmlNode.style.setProperty('--theme-color', themeColor);
    htmlNode.setAttribute('data-theme-color', themeColor);
  }

  // Text brightness
  const textBrightness = store.get<number>('textBrightness');
  if (textBrightness != null) {
    htmlNode.style.setProperty('--text-brightness', `${textBrightness}`);
  }

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

// Swipe-to-go-back gesture
function setupSwipeGesture(): void {
  // Parallax factor for the previous page revealed underneath the swipe (iOS uses ~0.3)
  const PARALLAX = 0.3;

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let currentPage: HTMLElement | null = null;
  let prevPage: HTMLElement | null = null;
  let swiping = false;

  // True only if the touch began inside an element the user can actually scroll
  // horizontally (overflow-x auto/scroll). `overflow-x: hidden` containers clip
  // their content but are NOT user-scrollable, so they must not block the gesture.
  function startsInHorizontalScroller(el: Element | null): boolean {
    let node: Element | null = el;
    while (node && node !== document.body) {
      const overflowX = getComputedStyle(node).overflowX;
      if ((overflowX === 'auto' || overflowX === 'scroll') &&
          node.scrollWidth > node.clientWidth + 1) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  // Position the previous page for the given progress (0 = swipe start, 1 = fully revealed)
  function setPrevParallax(progress: number): void {
    if (!prevPage) return;
    const offset = -window.innerWidth * PARALLAX * (1 - progress);
    prevPage.style.transform = `translate3d(${offset}px, 0, 0)`;
    prevPage.style.webkitTransform = `translate3d(${offset}px, 0, 0)`;
  }

  document.addEventListener('touchstart', (e: TouchEvent) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startTime = Date.now();
    swiping = false;
    prevPage = null;

    const homePage = document.querySelector('.page-home') as HTMLElement | null;
    if (homePage?.classList.contains('show-page')) {
      currentPage = null;
      return;
    }

    if (startX < 30 && !startsInHorizontalScroller(e.target as Element)) {
      currentPage = document.querySelector('.show-page') as HTMLElement | null;
      // The back gesture returns to home, so home is the page revealed underneath
      prevPage = homePage;
    } else {
      currentPage = null;
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e: TouchEvent) => {
    if (!currentPage) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = Math.abs(touch.clientY - startY);

    if (!swiping) {
      if (deltaX > 10 && deltaX > deltaY) {
        swiping = true;
        currentPage.classList.add('swiping');
        prevPage?.classList.add('swiping');
      } else if (deltaY > 10) {
        currentPage = null;
        prevPage = null;
        return;
      } else {
        return;
      }
    }

    e.preventDefault();
    const clampedX = Math.max(0, deltaX);
    currentPage.style.transform = `translate3d(${clampedX}px, 0, 0)`;
    currentPage.style.webkitTransform = `translate3d(${clampedX}px, 0, 0)`;
    setPrevParallax(clampedX / window.innerWidth);
  }, { passive: false });

  document.addEventListener('touchend', (e: TouchEvent) => {
    if (!currentPage || !swiping) {
      currentPage = null;
      prevPage = null;
      swiping = false;
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const deltaX = endX - startX;
    const duration = Date.now() - startTime;
    const velocity = deltaX / duration;
    const viewportWidth = window.innerWidth;
    const pastThreshold = deltaX > viewportWidth * 0.4 || velocity > 0.5;

    currentPage.classList.remove('swiping');
    currentPage.classList.add('swipe-settle');
    prevPage?.classList.remove('swiping');
    prevPage?.classList.add('swipe-settle');

    const page = currentPage;
    const prev = prevPage;

    if (pastThreshold) {
      page.style.transform = `translate3d(${viewportWidth}px, 0, 0)`;
      page.style.webkitTransform = `translate3d(${viewportWidth}px, 0, 0)`;
      setPrevParallax(1); // bring previous page fully into view
      const onEnd = () => {
        page.removeEventListener('transitionend', onEnd);
        page.classList.remove('swipe-settle');
        // Navigate first (home gets `show-page` at translate 0, matching our inline
        // transform), then clear the inline transform so the class takes over seamlessly.
        goBack();
        if (prev) {
          prev.classList.remove('swipe-settle');
          prev.style.transform = '';
          prev.style.webkitTransform = '';
        }
      };
      page.addEventListener('transitionend', onEnd);
    } else {
      page.style.transform = 'translate3d(0, 0, 0)';
      page.style.webkitTransform = 'translate3d(0, 0, 0)';
      setPrevParallax(0); // send previous page back to its parked parallax offset
      const onEnd = () => {
        page.removeEventListener('transitionend', onEnd);
        page.classList.remove('swipe-settle');
        page.style.transform = '';
        page.style.webkitTransform = '';
        if (prev) {
          prev.classList.remove('swipe-settle');
          prev.style.transform = '';
          prev.style.webkitTransform = '';
        }
      };
      page.addEventListener('transitionend', onEnd);
    }

    currentPage = null;
    prevPage = null;
    swiping = false;
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
    PubSub.publish('reload-home-complete');
  }

  function appendList(items: Array<Record<string, unknown>>): void {
    const list = homePageBody!.querySelector('.list');
    if (!list) return;

    // Get existing IDs to avoid duplicates
    const existingIds = new Set<string>();
    list.querySelectorAll('li[data-id]').forEach(li => {
      existingIds.add(li.getAttribute('data-id') || '');
    });

    const newItems = items.filter(item => item.id && !existingIds.has(String(item.id)));
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
    showPage('page-home', 'Hacker News');
    data.getArticles((items) => {
      renderList(items as unknown as Array<Record<string, unknown>>);
    }, true);
  });

  PubSub.subscribe('show-home', () => {
    showPage('page-home', 'Hacker News');
    if (!data.cache().list) {
      loading.show();
    }
    data.getArticles((items) => {
      renderList(items as unknown as Array<Record<string, unknown>>);
    }, false);
  });

  PubSub.subscribe('reload-home', () => {
    data.getArticles((items) => {
      renderList(items as unknown as Array<Record<string, unknown>>);
    }, true).catch((error) => {
      console.error('Failed to reload home:', error);
      loading.setStatus('Could not refresh stories');
      window.setTimeout(() => loading.clearStatus(), 3000);
      PubSub.publish('reload-home-error');
    });
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

  setupClickHandlers();
  setupSwipeGesture();
  initHomePage();
  initRouter();
  initCommentsPage();
  initArticlePage();
  initSettingsPage();
  initAboutPage();
  initPerformancePage();

  // iOS convention: tapping the status bar scrolls the view to the top
  // The native AppDelegate swizzles UIStatusBarManager and calls scrollTo via evaluateJavaScript

  // Load home page on start
  if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
    PubSub.publish('show-home');
  }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
