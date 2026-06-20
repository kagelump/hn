import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PubSub } from '../../utils/pubsub';
import { goHome, navigateTo, showPage } from '../router';

describe('router', () => {
  beforeEach(() => {
    // Minimal DOM mirroring index.html page structure
    document.body.innerHTML = `
      <div class="pages-container">
        <div class="page page-home show-page"></div>
        <div class="page page-article-content"></div>
        <div class="page page-article-comments"></div>
      </div>
    `;
    PubSub.clear();
  });

  afterEach(() => {
    PubSub.clear();
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
  });

  describe('showPage', () => {
    it('adds show-page class to target page', () => {
      showPage('page-article-content');

      const articlePage = document.querySelector('.page-article-content');
      const homePage = document.querySelector('.page-home');
      expect(articlePage?.classList.contains('show-page')).toBe(true);
      expect(homePage?.classList.contains('show-page')).toBe(false);
    });
  });
});
