import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as pullToRefresh from '../pullToRefresh';
import { PubSub } from '../../utils/pubsub';

describe('pullToRefresh', () => {
  let container: HTMLElement;
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.overflowY = 'auto';
    container.style.height = '300px';

    const content = document.createElement('div');
    content.className = 'bd';
    content.style.height = '1000px';
    container.appendChild(content);

    document.body.appendChild(container);
  });

  afterEach(() => {
    cleanup?.();
    document.body.innerHTML = '';
  });

  function createTouch(clientY: number, clientX = 0): Touch {
    return {
      identifier: 0,
      target: container,
      clientY,
      clientX,
      pageX: clientX,
      pageY: clientY,
      radiusX: 0,
      radiusY: 0,
      rotationAngle: 0,
      force: 1,
      altitudeAngle: 0,
      azimuthAngle: 0,
      touchType: 'direct',
    } as unknown as Touch;
  }

  function dispatchTouch(type: string, clientY: number, clientX = 0): void {
    const touch = createTouch(clientY, clientX);
    const event = new Event(type, {
      cancelable: true,
      bubbles: true,
    }) as unknown as TouchEvent;
    Object.defineProperty(event, 'touches', {
      value: type === 'touchend' ? [] : [touch],
      enumerable: true,
    });
    Object.defineProperty(event, 'changedTouches', {
      value: [touch],
      enumerable: true,
    });
    container.dispatchEvent(event);
  }

  it('does not refresh when pull is below threshold', () => {
    const onRefresh = vi.fn();
    cleanup = pullToRefresh.init({ container, threshold: 80, onRefresh });

    dispatchTouch('touchstart', 100);
    dispatchTouch('touchmove', 130);
    dispatchTouch('touchend', 130);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('calls onRefresh when pull crosses threshold', () => {
    const onRefresh = vi.fn();
    cleanup = pullToRefresh.init({ container, threshold: 80, onRefresh });

    dispatchTouch('touchstart', 100);
    dispatchTouch('touchmove', 300);
    dispatchTouch('touchend', 300);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not activate when not at top of container', () => {
    container.scrollTop = 50;
    const onRefresh = vi.fn();
    cleanup = pullToRefresh.init({ container, threshold: 80, onRefresh });

    dispatchTouch('touchstart', 100);
    dispatchTouch('touchmove', 300);
    dispatchTouch('touchend', 300);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('hides indicator when reload completes', () => {
    const onRefresh = vi.fn();
    cleanup = pullToRefresh.init({ container, threshold: 80, onRefresh });

    dispatchTouch('touchstart', 100);
    dispatchTouch('touchmove', 300);
    dispatchTouch('touchend', 300);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    const indicator = container.querySelector('.pull-to-refresh');
    expect(indicator?.classList.contains('pull-to-refresh-loading')).toBe(true);

    PubSub.publish('reload-home-complete');

    expect(indicator?.classList.contains('pull-to-refresh-loading')).toBe(false);
    expect((indicator as HTMLElement | null)?.style.transform).toBe('translate3d(0, 0px, 0)');
  });

  it('cancels pulling on horizontal-dominant gestures and does not refresh', () => {
    const onRefresh = vi.fn();
    cleanup = pullToRefresh.init({ container, threshold: 80, onRefresh });

    dispatchTouch('touchstart', 100);
    dispatchTouch('touchmove', 300, 400);
    dispatchTouch('touchend', 300, 400);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not reset the indicator when scroll top is still zero', () => {
    const onRefresh = vi.fn();
    cleanup = pullToRefresh.init({ container, threshold: 80, onRefresh });

    dispatchTouch('touchstart', 100);
    dispatchTouch('touchmove', 130);

    const indicator = container.querySelector('.pull-to-refresh');
    const transformBefore = (indicator as HTMLElement | null)?.style.transform;

    container.scrollTop = 0;
    container.dispatchEvent(new Event('scroll', { bubbles: true }));

    expect((indicator as HTMLElement | null)?.style.transform).toBe(transformBefore);
  });

  it('resets the indicator when scrolling back up while pulling', () => {
    const onRefresh = vi.fn();
    cleanup = pullToRefresh.init({ container, threshold: 80, onRefresh });

    dispatchTouch('touchstart', 100);
    dispatchTouch('touchmove', 130);

    container.scrollTop = 10;
    container.dispatchEvent(new Event('scroll', { bubbles: true }));

    const indicator = container.querySelector('.pull-to-refresh');
    expect(indicator?.classList.contains('pull-to-refresh-loading')).toBe(false);
    expect((indicator as HTMLElement | null)?.style.transform).toBe('translate3d(0, 0px, 0)');
  });

  it('resets the loading indicator when reload-home-error is published', () => {
    const onRefresh = vi.fn();
    cleanup = pullToRefresh.init({ container, threshold: 80, onRefresh });

    dispatchTouch('touchstart', 100);
    dispatchTouch('touchmove', 300);
    dispatchTouch('touchend', 300);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    const indicator = container.querySelector('.pull-to-refresh');
    expect(indicator?.classList.contains('pull-to-refresh-loading')).toBe(true);

    PubSub.publish('reload-home-error');

    expect(indicator?.classList.contains('pull-to-refresh-loading')).toBe(false);
    expect((indicator as HTMLElement | null)?.style.transform).toBe('translate3d(0, 0px, 0)');
  });

  it('resets the indicator when releasing a pull below the threshold', () => {
    const onRefresh = vi.fn();
    cleanup = pullToRefresh.init({ container, threshold: 80, onRefresh });

    dispatchTouch('touchstart', 100);
    dispatchTouch('touchmove', 130);
    dispatchTouch('touchend', 130);

    expect(onRefresh).not.toHaveBeenCalled();
    const indicator = container.querySelector('.pull-to-refresh');
    expect(indicator?.classList.contains('pull-to-refresh-loading')).toBe(false);
    expect((indicator as HTMLElement | null)?.style.transform).toBe('translate3d(0, 0px, 0)');
  });
});
