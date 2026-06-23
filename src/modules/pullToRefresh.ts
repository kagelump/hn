// Pull-to-refresh controller for the home page scroll container.
// Listens for vertical overscroll at the top and triggers a refresh callback.

import { PubSub } from '../utils/pubsub';

type PullToRefreshOptions = {
  container: HTMLElement;
  threshold?: number;
  maxPull?: number;
  onRefresh: () => void;
};

export function init(options: PullToRefreshOptions): () => void {
  const { container, threshold = 80, maxPull = 120, onRefresh } = options;

  let startX = 0;
  let startY = 0;
  let currentY = 0;
  let pulling = false;
  let refreshing = false;

  const indicator = document.createElement('div');
  indicator.className = 'pull-to-refresh';
  indicator.innerHTML = `
    <div class="show-loading"><div class="circle"></div></div>
    <div class="pull-to-refresh-text">Pull to refresh</div>
  `;
  container.prepend(indicator);

  const content = container.querySelector('.bd') as HTMLElement | null;

  function setState(state: 'pull' | 'release' | 'loading'): void {
    const text = indicator.querySelector('.pull-to-refresh-text');
    if (!text) return;
    if (state === 'pull') text.textContent = 'Pull to refresh';
    if (state === 'release') text.textContent = 'Release to refresh';
    if (state === 'loading') text.textContent = 'Refreshing…';
    indicator.classList.toggle('pull-to-refresh-loading', state === 'loading');
  }

  function setTransform(y: number): void {
    indicator.style.transform = `translate3d(0, ${y}px, 0)`;
    indicator.style.webkitTransform = `translate3d(0, ${y}px, 0)`;
    if (content) {
      content.style.transform = `translate3d(0, ${y}px, 0)`;
      content.style.webkitTransform = `translate3d(0, ${y}px, 0)`;
    }
  }

  function setPullingTransition(enabled: boolean): void {
    const transition = enabled ? 'transform 200ms ease-out' : 'none';
    indicator.style.transition = transition;
    indicator.style.webkitTransition = transition;
    if (content) {
      content.style.transition = transition;
      content.style.webkitTransition = transition;
    }
  }

  function reset(): void {
    pulling = false;
    refreshing = false;
    setPullingTransition(true);
    setTransform(0);
    setState('pull');
  }

  function onTouchStart(e: TouchEvent): void {
    if (refreshing) return;
    if (container.scrollTop > 0) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    pulling = true;
  }

  function onTouchMove(e: TouchEvent): void {
    if (!pulling || refreshing) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dy = y - startY;
    const dx = x - startX;

    // Ignore horizontal-dominant gestures so scrolling and swipes aren't hijacked.
    if (Math.abs(dx) > Math.abs(dy)) {
      pulling = false;
      return;
    }

    if (dy < 0) return;

    // Disable transitions during active pull so the content follows the finger.
    setPullingTransition(false);

    // Dampen the pull so it feels elastic.
    currentY = Math.min(dy * 0.5, maxPull);
    setTransform(currentY);
    setState(currentY >= threshold ? 'release' : 'pull');

    // Prevent default only when we are actively pulling.
    e.preventDefault();
  }

  function onTouchEnd(): void {
    if (!pulling || refreshing) return;
    if (currentY >= threshold) {
      refreshing = true;
      setState('loading');
      setTransform(threshold);
      onRefresh();
    } else {
      reset();
    }
  }

  function onScroll(): void {
    if (container.scrollTop <= 0) return;
    // If the user scrolls back up while still pulling, reset.
    if (pulling && !refreshing) reset();
  }

  function onComplete(): void {
    if (refreshing) reset();
  }
  function onError(): void {
    if (refreshing) reset();
  }
  PubSub.subscribe('reload-home-complete', onComplete);
  PubSub.subscribe('reload-home-error', onError);

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
  container.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('scroll', onScroll);
    PubSub.unsubscribe('reload-home-complete', onComplete);
    PubSub.unsubscribe('reload-home-error', onError);
    indicator.remove();
  };
}
