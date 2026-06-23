import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PubSub } from '../../utils/pubsub';
import { goHome, navigateTo, showPage, goBack, initRouter } from '../router';

vi.mock('../data', () => ({
  cancelPendingRequests: vi.fn()
}));

describe('router', () => {
  const popstateListeners: Array<EventListenerOrEventListenerObject> = [];

  beforeEach(() => {
    // Minimal DOM mirroring index.html page structure
    document.body.innerHTML = `
      <div class="pages-container">
        <div class="page page-home show-page"></div>
        <div class="page page-article-content"></div>
        <div class="page page-article-comments"></div>
        <div class="page page-settings"></div>
        <div class="page page-about"></div>
        <div class="page page-performance"></div>
      </div>
    `;
    PubSub.clear();
    window.location.hash = '';

    // Track popstate listeners so initRouter can be cleaned up between tests
    const originalAdd = window.addEventListener.bind(window);
    const originalRemove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'popstate') {
        popstateListeners.push(listener as EventListenerOrEventListenerObject);
      }
      return originalAdd(type, listener, options);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener, options) => {
      if (type === 'popstate') {
        const idx = popstateListeners.indexOf(listener as EventListenerOrEventListenerObject);
        if (idx !== -1) popstateListeners.splice(idx, 1);
      }
      return originalRemove(type, listener, options);
    });
  });

  afterEach(() => {
    PubSub.clear();
    window.location.hash = '';
    popstateListeners.forEach(listener => window.removeEventListener('popstate', listener));
    popstateListeners.length = 0;
    vi.restoreAllMocks();
  });

  describe('goHome', () => {
    it('publishes show-home instead of load-home', () => {
      const showHomeSpy = vi.fn();
      const loadHomeSpy = vi.fn();
      PubSub.subscribe('show-home', showHomeSpy);
      PubSub.subscribe('load-home', loadHomeSpy);

      goHome();

      expect(showHomeSpy).toHaveBeenCalledTimes(1);
      expect(loadHomeSpy).not.toHaveBeenCalled();
    });

    it('shows the home page', () => {
      goHome();

      const homePage = document.querySelector('.page-home');
      expect(homePage?.classList.contains('show-page')).toBe(true);
    });
  });

  describe('goBack', () => {
    it('calls window.history.back()', () => {
      const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

      goBack();

      expect(backSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('initRouter', () => {
    it('adds popstate listener and invokes handleRoute when popstate fires', () => {
      initRouter();

      const showHomeSpy = vi.fn();
      PubSub.subscribe('show-home', showHomeSpy);
      window.location.hash = '#/';
      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(showHomeSpy).toHaveBeenCalledTimes(1);
    });

    it('handles the initial route when window.location.hash is set', () => {
      window.location.hash = '#/comments/123';
      const showCommentsSpy = vi.fn();
      PubSub.subscribe('show-comments', showCommentsSpy);

      initRouter();

      expect(showCommentsSpy).toHaveBeenCalledTimes(1);
      expect(showCommentsSpy).toHaveBeenCalledWith(123);
    });
  });

  describe('navigateTo', () => {
    it('routes to home with show-home event for #/', () => {
      const showHomeSpy = vi.fn();
      const loadHomeSpy = vi.fn();
      PubSub.subscribe('show-home', showHomeSpy);
      PubSub.subscribe('load-home', loadHomeSpy);

      navigateTo('#/');

      expect(showHomeSpy).toHaveBeenCalledTimes(1);
      expect(loadHomeSpy).not.toHaveBeenCalled();
    });

    it('routes to comments for #/comments/:id', () => {
      const spy = vi.fn();
      PubSub.subscribe('show-comments', spy);

      navigateTo('#/comments/123');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(123);
    });

    it('routes to article for #/article/:id', () => {
      const spy = vi.fn();
      PubSub.subscribe('show-article', spy);

      navigateTo('#/article/456');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(456);
    });

    it('routes to settings for #/settings', () => {
      const spy = vi.fn();
      PubSub.subscribe('show-settings', spy);

      navigateTo('#/settings');

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('routes to about for #/about', () => {
      const spy = vi.fn();
      PubSub.subscribe('show-about', spy);

      navigateTo('#/about');

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('routes to performance for #/performance', () => {
      const spy = vi.fn();
      PubSub.subscribe('show-performance', spy);

      navigateTo('#/performance');

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('falls back to home for unknown hashes', () => {
      const showHomeSpy = vi.fn();
      PubSub.subscribe('show-home', showHomeSpy);

      navigateTo('#/unknown');

      expect(showHomeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('showPage', () => {
    it('adds show-page class to target page', () => {
      showPage('page-article-content');

      const articlePage = document.querySelector('.page-article-content');
      const homePage = document.querySelector('.page-home');
      expect(articlePage?.classList.contains('show-page')).toBe(true);
      expect(homePage?.classList.contains('show-page')).toBe(false);
    });

    it('sets document.title when a title is provided', () => {
      document.title = 'Original';

      showPage('page-article-content', 'Article');

      expect(document.title).toBe('Article');
    });

    it('cleans up exit-left classes after transitionend', () => {
      const homePage = document.querySelector('.page-home') as HTMLElement;

      showPage('page-article-content');
      expect(homePage.classList.contains('exit-left')).toBe(true);

      homePage.dispatchEvent(new TransitionEvent('transitionend'));
      expect(homePage.classList.contains('exit-left')).toBe(false);
      expect(homePage.classList.contains('exit-right')).toBe(false);
    });

    it('cleans up exit-right classes after transitionend', () => {
      const articlePage = document.querySelector('.page-article-content') as HTMLElement;
      articlePage.classList.add('show-page');
      const homePage = document.querySelector('.page-home') as HTMLElement;
      homePage.classList.remove('show-page');

      showPage('page-home');
      expect(articlePage.classList.contains('exit-right')).toBe(true);

      articlePage.dispatchEvent(new TransitionEvent('transitionend'));
      expect(articlePage.classList.contains('exit-left')).toBe(false);
      expect(articlePage.classList.contains('exit-right')).toBe(false);
    });

    it('cleans up exit-left classes after setTimeout fallback', () => {
      vi.useFakeTimers();
      const homePage = document.querySelector('.page-home') as HTMLElement;

      showPage('page-article-content');
      expect(homePage.classList.contains('exit-left')).toBe(true);

      vi.advanceTimersByTime(500);
      expect(homePage.classList.contains('exit-left')).toBe(false);
      expect(homePage.classList.contains('exit-right')).toBe(false);

      vi.useRealTimers();
    });

    it('cleans up exit-right classes after setTimeout fallback', () => {
      vi.useFakeTimers();
      const articlePage = document.querySelector('.page-article-content') as HTMLElement;
      articlePage.classList.add('show-page');
      const homePage = document.querySelector('.page-home') as HTMLElement;
      homePage.classList.remove('show-page');

      showPage('page-home');
      expect(articlePage.classList.contains('exit-right')).toBe(true);

      vi.advanceTimersByTime(500);
      expect(articlePage.classList.contains('exit-left')).toBe(false);
      expect(articlePage.classList.contains('exit-right')).toBe(false);

      vi.useRealTimers();
    });
  });
});
