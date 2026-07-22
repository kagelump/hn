import { PubSub } from '../utils/pubsub';
import { getBackPageClass, goBack } from './router';

const EDGE_WIDTH = 30;
const START_THRESHOLD = 10;
const DISTANCE_THRESHOLD = 0.4;
const VELOCITY_THRESHOLD = 0.5;
const PARALLAX = 0.3;
const SETTLE_TIMEOUT_MS = 260;
const ROUTE_TIMEOUT_MS = 600;
const CLICK_SUPPRESSION_MS = 400;

function findTouch(touches: TouchList, identifier: number): Touch | null {
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches.item(index);
    if (touch?.identifier === identifier) return touch;
  }
  return null;
}

function startsInHorizontalScroller(element: Element | null): boolean {
  let node = element;
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

export function setupSwipeGesture(): () => void {
  let activeTouchId: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let startTime = 0;
  let currentPage: HTMLElement | null = null;
  let previousPage: HTMLElement | null = null;
  let swiping = false;
  let settling = false;
  let suppressClicksUntil = 0;
  let cancelSettleWait: (() => void) | null = null;
  let routeFallbackTimer = 0;

  const pagesContainer = document.querySelector('.pages-container') as HTMLElement | null;

  function setPreviousPageParallax(progress: number): void {
    if (!previousPage) return;
    const clampedProgress = Math.min(1, Math.max(0, progress));
    const offset = -window.innerWidth * PARALLAX * (1 - clampedProgress);
    previousPage.style.transform = `translate3d(${offset}px, 0, 0)`;
    previousPage.style.webkitTransform = `translate3d(${offset}px, 0, 0)`;
  }

  function clearPageStyles(page: HTMLElement | null): void {
    if (!page) return;
    page.classList.remove('swiping', 'swipe-settle');
    page.style.transform = '';
    page.style.webkitTransform = '';
  }

  function resetGesture(): void {
    cancelSettleWait?.();
    cancelSettleWait = null;
    window.clearTimeout(routeFallbackTimer);
    routeFallbackTimer = 0;
    clearPageStyles(currentPage);
    clearPageStyles(previousPage);
    pagesContainer?.classList.remove('navigation-locked');
    activeTouchId = null;
    currentPage = null;
    previousPage = null;
    swiping = false;
    settling = false;
  }

  function waitForSettle(page: HTMLElement, callback: () => void): () => void {
    let completed = false;
    let timeoutId = 0;

    const finish = () => {
      if (completed) return;
      completed = true;
      window.clearTimeout(timeoutId);
      page.removeEventListener('transitionend', onTransitionEnd);
      callback();
    };

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== page) return;
      if (event.propertyName && !event.propertyName.includes('transform')) return;
      finish();
    };

    page.addEventListener('transitionend', onTransitionEnd);
    const timeout = document.documentElement.classList.contains('no-animation')
      ? 0
      : SETTLE_TIMEOUT_MS;
    timeoutId = window.setTimeout(finish, timeout);

    return () => {
      if (completed) return;
      completed = true;
      window.clearTimeout(timeoutId);
      page.removeEventListener('transitionend', onTransitionEnd);
    };
  }

  function finishSuccessfulSwipe(): void {
    const onRouteChanged = () => {
      PubSub.unsubscribe('route-changed', onRouteChanged);
      resetGesture();
    };

    PubSub.subscribe('route-changed', onRouteChanged);
    const usedHistory = goBack();

    // Direct-entry fallback navigation publishes synchronously.
    if (!usedHistory) return;

    // WKWebView normally dispatches popstate immediately. This prevents an
    // interrupted native lifecycle transition from leaving the app locked.
    routeFallbackTimer = window.setTimeout(() => {
      PubSub.unsubscribe('route-changed', onRouteChanged);
      resetGesture();
    }, ROUTE_TIMEOUT_MS);
  }

  function settleSwipe(completed: boolean): void {
    if (!currentPage || settling) return;
    settling = true;
    activeTouchId = null;
    suppressClicksUntil = Date.now() + CLICK_SUPPRESSION_MS;

    currentPage.classList.remove('swiping');
    currentPage.classList.add('swipe-settle');
    previousPage?.classList.remove('swiping');
    previousPage?.classList.add('swipe-settle');

    if (completed) {
      const viewportWidth = window.innerWidth;
      currentPage.style.transform = `translate3d(${viewportWidth}px, 0, 0)`;
      currentPage.style.webkitTransform = `translate3d(${viewportWidth}px, 0, 0)`;
      setPreviousPageParallax(1);
      cancelSettleWait = waitForSettle(currentPage, finishSuccessfulSwipe);
    } else {
      currentPage.style.transform = 'translate3d(0, 0, 0)';
      currentPage.style.webkitTransform = 'translate3d(0, 0, 0)';
      setPreviousPageParallax(0);
      cancelSettleWait = waitForSettle(currentPage, resetGesture);
    }
  }

  function cancelForAdditionalTouch(event: TouchEvent): void {
    event.preventDefault();
    suppressClicksUntil = Date.now() + CLICK_SUPPRESSION_MS;

    if (!swiping && !settling) {
      activeTouchId = null;
      currentPage = null;
      previousPage = null;
      return;
    }

    if (swiping) settleSwipe(false);
  }

  const onTouchStart = (event: TouchEvent) => {
    if (settling) {
      event.preventDefault();
      suppressClicksUntil = Date.now() + CLICK_SUPPRESSION_MS;
      return;
    }

    if (activeTouchId !== null || event.touches.length !== 1 || event.changedTouches.length !== 1) {
      cancelForAdditionalTouch(event);
      return;
    }

    const touch = event.changedTouches.item(0);
    if (!touch) return;

    const activePage = document.querySelector('.page.show-page') as HTMLElement | null;
    const backPage = document.querySelector(`.${getBackPageClass()}`) as HTMLElement | null;

    if (touch.clientX >= EDGE_WIDTH || !activePage || !backPage || activePage === backPage ||
        startsInHorizontalScroller(event.target as Element | null)) {
      return;
    }

    activeTouchId = touch.identifier;
    startX = touch.clientX;
    startY = touch.clientY;
    lastX = touch.clientX;
    startTime = Date.now();
    currentPage = activePage;
    previousPage = backPage;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (activeTouchId === null || !currentPage) return;

    if (event.touches.length > 1) {
      cancelForAdditionalTouch(event);
      return;
    }

    const touch = findTouch(event.touches, activeTouchId);
    if (!touch) return;

    const deltaX = touch.clientX - startX;
    const deltaY = Math.abs(touch.clientY - startY);

    if (!swiping) {
      if (deltaX > START_THRESHOLD && deltaX > deltaY) {
        swiping = true;
        pagesContainer?.classList.add('navigation-locked');
        currentPage.classList.add('swiping');
        previousPage?.classList.add('swiping');
      } else if (deltaY > START_THRESHOLD || deltaX < -START_THRESHOLD) {
        activeTouchId = null;
        currentPage = null;
        previousPage = null;
        return;
      } else {
        return;
      }
    }

    event.preventDefault();
    lastX = touch.clientX;
    const clampedX = Math.max(0, deltaX);
    currentPage.style.transform = `translate3d(${clampedX}px, 0, 0)`;
    currentPage.style.webkitTransform = `translate3d(${clampedX}px, 0, 0)`;
    setPreviousPageParallax(clampedX / window.innerWidth);
  };

  const onTouchEnd = (event: TouchEvent) => {
    if (activeTouchId === null) {
      if (settling) event.preventDefault();
      return;
    }

    const touch = findTouch(event.changedTouches, activeTouchId);
    if (!touch) {
      if (swiping) {
        event.preventDefault();
        suppressClicksUntil = Date.now() + CLICK_SUPPRESSION_MS;
      }
      return;
    }

    if (!currentPage || !swiping) {
      activeTouchId = null;
      currentPage = null;
      previousPage = null;
      return;
    }

    event.preventDefault();
    lastX = touch.clientX;
    const deltaX = lastX - startX;
    const duration = Math.max(1, Date.now() - startTime);
    const velocity = deltaX / duration;
    const completed = deltaX > window.innerWidth * DISTANCE_THRESHOLD || velocity > VELOCITY_THRESHOLD;
    settleSwipe(completed);
  };

  const onTouchCancel = (event: TouchEvent) => {
    if (activeTouchId === null) return;
    if (!findTouch(event.changedTouches, activeTouchId)) return;
    event.preventDefault();
    if (swiping) {
      settleSwipe(false);
    } else {
      resetGesture();
    }
  };

  const onClickCapture = (event: MouseEvent) => {
    if (!pagesContainer?.contains(event.target as Node)) return;
    if (!settling && Date.now() >= suppressClicksUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  document.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: false });
  document.addEventListener('touchcancel', onTouchCancel, { passive: false });
  document.addEventListener('click', onClickCapture, true);

  return () => {
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    document.removeEventListener('touchcancel', onTouchCancel);
    document.removeEventListener('click', onClickCapture, true);
    resetGesture();
  };
}
