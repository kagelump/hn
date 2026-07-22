import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PubSub } from '../../utils/pubsub';
import type { HNItem } from '../../types';

const routeState = vi.hoisted(() => ({
  action: 'article',
  id: 1,
  revision: 1,
  backPageClass: 'page-home',
  showPage: vi.fn()
}));

const dataMocks = vi.hoisted(() => ({
  articleCallbacks: new Map<number, (item: HNItem) => void>(),
  commentCallbacks: new Map<number, (item: HNItem) => void>(),
  getArticleById: vi.fn(() => undefined as HNItem | undefined),
  getArticleMeta: vi.fn((id: number, callback: (item: HNItem) => void) => {
    dataMocks.articleCallbacks.set(id, callback);
    return Promise.resolve();
  }),
  getArticleComments: vi.fn((id: number, callback: (item: HNItem) => void) => {
    dataMocks.commentCallbacks.set(id, callback);
    return Promise.resolve();
  })
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
  CapacitorHttp: { get: vi.fn() }
}));

vi.mock('../data', () => ({
  data: {
    getArticleById: dataMocks.getArticleById,
    getArticleMeta: dataMocks.getArticleMeta,
    getArticleComments: dataMocks.getArticleComments
  }
}));

vi.mock('../router', () => ({
  getRouteRevision: () => routeState.revision,
  isRouteRevision: (revision: number) => revision === routeState.revision,
  isCurrentRoute: (action: string, id?: number) =>
    action === routeState.action && (id === undefined || id === routeState.id),
  getBackPageClass: () => routeState.backPageClass,
  showPage: routeState.showPage
}));

import { initArticlePage } from '../article';
import { initCommentsPage } from '../comments';

function article(id: number, title: string): HNItem {
  return {
    id,
    title,
    points: 10,
    user: 'alice',
    time_ago: '1 hour ago',
    comments_count: 0,
    text: `<p>${title} body</p>`,
    type: 'story',
    kids: [],
    comments: []
  };
}

describe('route-scoped page rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="pages-container">
        <div class="page page-home"></div>
        <div class="page page-article-content"></div>
        <div class="page page-article-comments"></div>
      </div>
    `;
    PubSub.clear();
    dataMocks.articleCallbacks.clear();
    dataMocks.commentCallbacks.clear();
    dataMocks.getArticleById.mockReturnValue(undefined);
    routeState.action = 'article';
    routeState.id = 1;
    routeState.revision = 1;
    routeState.backPageClass = 'page-home';
    routeState.showPage.mockReset();
    routeState.showPage.mockImplementation((pageClass: string) => {
      document.querySelectorAll('.page').forEach(page => page.classList.remove('show-page'));
      document.querySelector(`.${pageClass}`)?.classList.add('show-page');
    });
    initArticlePage();
    initCommentsPage();
  });

  it('does not let an older article response overwrite the current article', () => {
    PubSub.publish('show-article', 1);
    routeState.id = 2;
    routeState.revision = 2;
    PubSub.publish('show-article', 2);

    dataMocks.articleCallbacks.get(1)?.(article(1, 'Old article'));
    expect(document.querySelector('.page-article-content')?.textContent).not.toContain('Old article');

    dataMocks.articleCallbacks.get(2)?.(article(2, 'Current article'));
    expect(document.querySelector('.page-article-content')?.textContent).toContain('Current article');
  });

  it('does not let an older comments response overwrite the current discussion', () => {
    routeState.action = 'comments';
    PubSub.publish('show-comments', 1);
    routeState.id = 2;
    routeState.revision = 2;
    PubSub.publish('show-comments', 2);

    dataMocks.commentCallbacks.get(1)?.(article(1, 'Old discussion'));
    expect(document.querySelector('.page-article-comments')?.textContent).not.toContain('Old discussion');

    dataMocks.commentCallbacks.get(2)?.(article(2, 'Current discussion'));
    expect(document.querySelector('.page-article-comments')?.textContent).toContain('Current discussion');
  });

  it('does not let an old hide timer erase a newly reopened article page', () => {
    vi.useFakeTimers();
    PubSub.publish('show-article', 1);
    dataMocks.articleCallbacks.get(1)?.(article(1, 'First render'));
    const page = document.querySelector('.page-article-content') as HTMLElement;

    page.classList.remove('show-page');
    PubSub.publish('onPageHidden', page.className);

    routeState.revision = 2;
    PubSub.publish('show-article', 1);
    dataMocks.articleCallbacks.get(1)?.(article(1, 'Reopened render'));
    vi.advanceTimersByTime(450);

    expect(page.textContent).toContain('Reopened render');
    vi.useRealTimers();
  });

  it('does not let an old hide timer erase a newly reopened comments page', () => {
    vi.useFakeTimers();
    routeState.action = 'comments';
    PubSub.publish('show-comments', 1);
    dataMocks.commentCallbacks.get(1)?.(article(1, 'First discussion'));
    const page = document.querySelector('.page-article-comments') as HTMLElement;

    page.classList.remove('show-page');
    PubSub.publish('onPageHidden', page.className);

    routeState.revision = 2;
    PubSub.publish('show-comments', 1);
    dataMocks.commentCallbacks.get(1)?.(article(1, 'Reopened discussion'));
    vi.advanceTimersByTime(450);

    expect(page.textContent).toContain('Reopened discussion');
    vi.useRealTimers();
  });

  it('keeps the true previous page rendered for the interactive back reveal', () => {
    vi.useFakeTimers();
    PubSub.publish('show-article', 1);
    dataMocks.articleCallbacks.get(1)?.(article(1, 'Previous article'));
    const page = document.querySelector('.page-article-content') as HTMLElement;
    page.classList.remove('show-page');
    routeState.backPageClass = 'page-article-content';

    PubSub.publish('onPageHidden', page.className);
    vi.advanceTimersByTime(1_000);

    expect(page.textContent).toContain('Previous article');
    vi.useRealTimers();
  });
});
