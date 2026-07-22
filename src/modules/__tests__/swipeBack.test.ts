import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PubSub } from '../../utils/pubsub';

const routerMocks = vi.hoisted(() => ({
  getBackPageClass: vi.fn(() => 'page-home'),
  goBack: vi.fn(() => true)
}));

vi.mock('../router', () => routerMocks);

import { setupSwipeGesture } from '../swipeBack';

function touch(identifier: number, clientX: number, clientY: number): Touch {
  return { identifier, clientX, clientY } as Touch;
}

function touchList(touches: Touch[]): TouchList {
  const list = [...touches] as unknown as TouchList & Touch[];
  Object.defineProperty(list, 'item', {
    value: (index: number) => list[index] ?? null
  });
  return list;
}

function dispatchTouch(
  target: Element,
  type: string,
  activeTouches: Touch[],
  changedTouches: Touch[]
): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperties(event, {
    touches: { value: touchList(activeTouches) },
    changedTouches: { value: touchList(changedTouches) },
    targetTouches: { value: touchList(activeTouches) }
  });
  target.dispatchEvent(event);
  return event;
}

describe('iOS edge swipe navigation', () => {
  let teardown: (() => void) | undefined;
  let homePage: HTMLElement;
  let articlePage: HTMLElement;
  let commentsLink: HTMLAnchorElement;

  beforeEach(() => {
    document.documentElement.classList.remove('no-animation');
    document.body.innerHTML = `
      <div class="pages-container">
        <div class="page page-home">
          <a class="comments" href="#/comments/222">comments</a>
        </div>
        <div class="page page-article-content show-page"><div class="child"></div></div>
      </div>
    `;
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    homePage = document.querySelector('.page-home') as HTMLElement;
    articlePage = document.querySelector('.page-article-content') as HTMLElement;
    commentsLink = document.querySelector('.comments') as HTMLAnchorElement;
    routerMocks.getBackPageClass.mockReturnValue('page-home');
    routerMocks.goBack.mockReturnValue(true);
    routerMocks.goBack.mockClear();
    PubSub.clear();
    teardown = setupSwipeGesture();
  });

  afterEach(() => {
    teardown?.();
    teardown = undefined;
    PubSub.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function beginSwipe(endX = 220): Touch {
    const start = touch(7, 5, 300);
    const moved = touch(7, endX, 300);
    dispatchTouch(articlePage, 'touchstart', [start], [start]);
    dispatchTouch(articlePage, 'touchmove', [moved], [moved]);
    return moved;
  }

  it('locks every page and suppresses a palm click while settling', () => {
    const moved = beginSwipe();
    const endEvent = dispatchTouch(articlePage, 'touchend', [], [moved]);
    const clickSpy = vi.fn();
    commentsLink.addEventListener('click', clickSpy);
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

    commentsLink.dispatchEvent(clickEvent);

    expect(endEvent.defaultPrevented).toBe(true);
    expect(document.querySelector('.pages-container')?.classList.contains('navigation-locked')).toBe(true);
    expect(clickEvent.defaultPrevented).toBe(true);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('navigates only after the outgoing page transform settles', () => {
    const moved = beginSwipe();
    dispatchTouch(articlePage, 'touchend', [], [moved]);

    const child = articlePage.querySelector('.child') as HTMLElement;
    child.dispatchEvent(new TransitionEvent('transitionend', {
      bubbles: true,
      propertyName: 'transform'
    }));
    expect(routerMocks.goBack).not.toHaveBeenCalled();

    articlePage.dispatchEvent(new TransitionEvent('transitionend', {
      propertyName: 'transform'
    }));
    expect(routerMocks.goBack).toHaveBeenCalledTimes(1);

    PubSub.publish('route-changed', 'home', undefined, 2);
    expect(document.querySelector('.pages-container')?.classList.contains('navigation-locked')).toBe(false);
    expect(articlePage.style.transform).toBe('');
    expect(homePage.style.transform).toBe('');
  });

  it('cancels safely when a second palm touch appears', () => {
    const moved = beginSwipe(80);
    const palm = touch(99, 380, 300);

    const secondStart = dispatchTouch(homePage, 'touchstart', [moved, palm], [palm]);
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    commentsLink.dispatchEvent(clickEvent);

    expect(secondStart.defaultPrevented).toBe(true);
    expect(clickEvent.defaultPrevented).toBe(true);
    expect(routerMocks.goBack).not.toHaveBeenCalled();

    articlePage.dispatchEvent(new TransitionEvent('transitionend', {
      propertyName: 'transform'
    }));
    expect(document.querySelector('.pages-container')?.classList.contains('navigation-locked')).toBe(false);
  });

  it('suppresses a second touch even before the edge gesture is claimed', () => {
    const start = touch(7, 5, 300);
    const palm = touch(99, 380, 300);
    dispatchTouch(articlePage, 'touchstart', [start], [start]);

    const secondStart = dispatchTouch(articlePage, 'touchstart', [start, palm], [palm]);
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    commentsLink.dispatchEvent(clickEvent);

    expect(secondStart.defaultPrevented).toBe(true);
    expect(clickEvent.defaultPrevented).toBe(true);
    expect(routerMocks.goBack).not.toHaveBeenCalled();
  });

  it('ignores touchend events for a different touch identifier', () => {
    const moved = beginSwipe();
    const palm = touch(99, 380, 300);

    dispatchTouch(homePage, 'touchend', [moved], [palm]);
    expect(articlePage.classList.contains('swiping')).toBe(true);

    dispatchTouch(articlePage, 'touchend', [], [moved]);
    articlePage.dispatchEvent(new TransitionEvent('transitionend', {
      propertyName: 'transform'
    }));
    expect(routerMocks.goBack).toHaveBeenCalledTimes(1);
  });

  it('restores the page after touchcancel', () => {
    const moved = beginSwipe(80);

    const cancelEvent = dispatchTouch(articlePage, 'touchcancel', [], [moved]);
    articlePage.dispatchEvent(new TransitionEvent('transitionend', {
      propertyName: 'transform'
    }));

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(routerMocks.goBack).not.toHaveBeenCalled();
    expect(articlePage.style.transform).toBe('');
    expect(homePage.style.transform).toBe('');
  });

  it('uses the fallback when animations are disabled', () => {
    vi.useFakeTimers();
    document.documentElement.classList.add('no-animation');
    const moved = beginSwipe();

    dispatchTouch(articlePage, 'touchend', [], [moved]);
    vi.advanceTimersByTime(0);

    expect(routerMocks.goBack).toHaveBeenCalledTimes(1);
    PubSub.publish('route-changed', 'home', undefined, 2);
  });

  it('settles back without navigating when distance and velocity are too low', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const start = touch(7, 5, 300);
    const moved = touch(7, 50, 300);
    dispatchTouch(articlePage, 'touchstart', [start], [start]);
    dispatchTouch(articlePage, 'touchmove', [moved], [moved]);
    vi.setSystemTime(2_000);

    dispatchTouch(articlePage, 'touchend', [], [moved]);
    vi.advanceTimersByTime(260);

    expect(routerMocks.goBack).not.toHaveBeenCalled();
    expect(articlePage.style.transform).toBe('');
    expect(document.querySelector('.pages-container')?.classList.contains('navigation-locked')).toBe(false);
  });
});
