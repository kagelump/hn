# Front Page Overscroll Gestures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pull-to-refresh on top and fix/visible auto-load-more on bottom for the home page story list.

**Architecture:** A new `pullToRefresh.ts` module tracks touch/scroll state on `.pagebd-container`, translates the list content down, and publishes `reload-home` when the release threshold is crossed. The existing bottom auto-load is fixed by moving the scroll listener from `.bd` to `.pagebd-container`. CSS provides the PTR indicator and bottom loading indicator.

**Tech Stack:** Vanilla TypeScript, Vite, Vitest, Playwright, custom PubSub event bus.

---

## Task 1: Fix bottom infinite-scroll listener target

**Files:**
- Modify: `src/main.ts:332-454`

The scroll listener is currently attached to `homePageBody` (`.bd`), which never scrolls. The real scroll container is `.pagebd-container`.

- [ ] **Step 1: Locate the scroll listener block**

  Read `src/main.ts` around lines 432-453.

- [ ] **Step 2: Change the scroll container selector**

  Replace:
  ```typescript
  // Infinite scroll: load more when near bottom
  const scrollContainer = homePageBody;
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', () => {
  ```

  With:
  ```typescript
  // Infinite scroll: load more when near bottom
  const scrollContainer = homePage?.querySelector('.pagebd-container') as HTMLElement | null;
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', () => {
  ```

- [ ] **Step 3: Verify the rest of the block still uses the variable correctly**

  The block should still read `scrollTop`, `scrollHeight`, and `clientHeight` from `scrollContainer`, and still query `homePageBody` for the list/indicator DOM manipulation.

- [ ] **Step 4: Run existing tests**

  Run: `npm test`
  Expected: existing unit tests pass; no TypeScript errors.

---

## Task 2: Create the pull-to-refresh module

**Files:**
- Create: `src/modules/pullToRefresh.ts`

- [ ] **Step 1: Create the module file**

  ```typescript
  import { PubSub } from '../utils/pubsub';

  // Pull-to-refresh controller for the home page scroll container.
  // Listens for vertical overscroll at the top and triggers a refresh callback.

  type PullToRefreshOptions = {
    container: HTMLElement;
    threshold?: number;
    maxPull?: number;
    onRefresh: () => void;
  };

  export function init(options: PullToRefreshOptions): () => void {
    const { container, threshold = 80, maxPull = 120, onRefresh } = options;

    let startY = 0;
    let currentY = 0;
    let pulling = false;
    let refreshing = false;

    const indicator = document.createElement('div');
    indicator.className = 'pull-to-refresh';
    indicator.innerHTML = `
      <div class="pull-to-refresh-spinner"><div class="circle"></div></div>
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

    function reset(): void {
      pulling = false;
      refreshing = false;
      setTransform(0);
      setState('pull');
    }

    function onTouchStart(e: TouchEvent): void {
      if (refreshing) return;
      if (container.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    }

    function onTouchMove(e: TouchEvent): void {
      if (!pulling || refreshing) return;
      const y = e.touches[0].clientY;
      const dy = y - startY;
      if (dy < 0) return;

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

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('scroll', onScroll);
      indicator.remove();
    };
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors.

---

## Task 3: Add CSS for PTR and bottom indicator

**Files:**
- Modify: `src/styles/pages.css`

- [ ] **Step 1: Add overscroll-behavior and touch-action to the scroll container**

  Find the `.pagebd-container` block (around line 97) and add:
  ```css
  .pages-container .pagebd-container {
    position: absolute;
    top: calc(50px + env(safe-area-inset-top));
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255,255,255,0.95);
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    -ms-overflow-style: -ms-autohiding-scrollbar;
    overscroll-behavior-y: contain;
    touch-action: pan-y;
  }
  ```

- [ ] **Step 2: Add PTR indicator styles**

  Append to `src/styles/pages.css`:
  ```css
  .pull-to-refresh {
    position: absolute;
    top: -80px;
    left: 0;
    right: 0;
    height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--theme-color);
    font-size: 0.85rem;
    pointer-events: none;
    transform: translate3d(0, 0, 0);
    transition: transform 200ms ease-out;
    z-index: 1;
  }

  .pull-to-refresh .circle {
    width: 20px;
    height: 20px;
    border: 2px solid var(--theme-color);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .pull-to-refresh-text {
    margin-top: 6px;
  }
  ```

- [ ] **Step 3: Add bottom load-more indicator styles**

  Append to `src/styles/pages.css`:
  ```css
  .load-more-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px 0;
  }

  .load-more-indicator .circle {
    width: 20px;
    height: 20px;
    border: 2px solid var(--theme-color);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  ```

- [ ] **Step 4: Ensure .bd transitions smoothly**

  Add to the `.pagebd-container .bd` rule:
  ```css
  .pagebd-container .bd {
    padding-bottom: env(safe-area-inset-bottom);
    transition: transform 200ms ease-out;
  }
  ```

---

## Task 4: Wire pull-to-refresh into initHomePage

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Import the module**

  Add near the top of `src/main.ts`:
  ```typescript
  import * as pullToRefresh from './modules/pullToRefresh';
  ```

- [ ] **Step 2: Initialize PTR in initHomePage**

  Inside `initHomePage()`, after creating `homePageBody` and before the subscriptions, add:
  ```typescript
  const scrollContainer = homePage?.querySelector('.pagebd-container') as HTMLElement | null;
  if (scrollContainer) {
    pullToRefresh.init({
      container: scrollContainer,
      onRefresh: () => {
        PubSub.publish('reload-home');
      }
    });
  }
  ```

- [ ] **Step 3: Keep the existing reload-home subscription**

  The reload button still publishes `reload-home`; PTR reuses the same subscription.

- [ ] **Step 4: Hide PTR indicator when reload completes**

  The `renderList` callback already hides the global `#loading` spinner. To also reset the PTR UI, publish a completion event. Update the `renderList` function (around line 346) to add at the end:
  ```typescript
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
  ```

- [ ] **Step 5: Update pullToRefresh to listen for completion**

  Modify `src/modules/pullToRefresh.ts` so `init` also subscribes to `reload-home-complete` and calls `reset()` when received. Add inside `init`:
  ```typescript
  function onComplete(): void {
    if (refreshing) reset();
  }
  PubSub.subscribe('reload-home-complete', onComplete);
  ```

  And include in the cleanup function:
  ```typescript
  return () => {
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('scroll', onScroll);
    PubSub.unsubscribe('reload-home-complete', onComplete);
  };
  ```

  `PubSub.unsubscribe` already exists in `src/utils/pubsub.ts`, so no changes are needed there.
  In `src/modules/pullToRefresh.ts`, import PubSub as:
  ```typescript
  import { PubSub } from '../utils/pubsub';
  ```

- [ ] **Step 6: Compile and run unit tests**

  Run: `npm test`
  Expected: all existing tests still pass.

---

## Task 5: Add unit tests for pullToRefresh

**Files:**
- Create: `src/modules/__tests__/pullToRefresh.test.ts`

- [ ] **Step 1: Create the test file**

  ```typescript
  import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
  import * as pullToRefresh from '../pullToRefresh';

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

    function dispatchTouch(type: string, clientY: number): void {
      const touch = new Touch({
        identifier: 0,
        target: container,
        clientY,
        clientX: 0,
        pageX: 0,
        pageY: clientY,
        radiusX: 0,
        radiusY: 0,
        rotationAngle: 0,
        force: 1,
      });
      const event = new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [touch],
        changedTouches: [touch],
        cancelable: true,
        bubbles: true,
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
  });
  ```

- [ ] **Step 2: Run the new tests**

  Run: `npx vitest run src/modules/__tests__/pullToRefresh.test.ts`
  Expected: all three tests pass.

---

## Task 6: Add E2E tests for PTR and infinite scroll

**Files:**
- Modify: `e2e/app.spec.ts`

- [ ] **Step 1: Add infinite-scroll test**

  Append a new test inside `test.describe`:
  ```typescript
  test('infinite scroll loads more stories', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });

    // Scroll the actual scroll container to the bottom
    await page.locator('.pagebd-container').evaluate(el => el.scrollTop = el.scrollHeight);

    // Wait for more items to load
    await expect(page.locator('.page-home .list li')).toHaveCount(60, { timeout: 15000 });
  });
  ```

- [ ] **Step 2: Add pull-to-refresh test**

  Append a new test inside `test.describe`:
  ```typescript
  test('pull to refresh reloads stories', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });

    // Simulate pull-to-refresh via touch
    const container = page.locator('.pagebd-container');
    const box = await container.boundingBox();
    if (!box) throw new Error('Container not found');

    await container.dispatchEvent('touchstart', {
      touches: [{ clientX: box.x + box.width / 2, clientY: box.y + 100 }],
    });
    await container.dispatchEvent('touchmove', {
      touches: [{ clientX: box.x + box.width / 2, clientY: box.y + 300 }],
    });
    await container.dispatchEvent('touchend', {
      changedTouches: [{ clientX: box.x + box.width / 2, clientY: box.y + 300 }],
    });

    await expect(page.locator('.pull-to-refresh-loading')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.page-home .list li')).toHaveCount(30, { timeout: 15000 });
  });
  ```

- [ ] **Step 3: Run E2E tests**

  Run: `npx playwright test`
  Expected: all E2E tests pass.

---

## Task 7: Final verification

- [ ] **Step 1: Run full test suite**

  Run: `npm test && npx playwright test`
  Expected: unit tests and E2E tests pass.

- [ ] **Step 2: Manual smoke test in dev server**

  Run: `npm run dev`
  Then:
  - Open the app in a mobile viewport.
  - Scroll down and verify more stories load.
  - Pull down at the top and verify the spinner appears and the list reloads.
  - Verify the reload button still works.

---

## Spec Coverage Checklist

- [x] Fix broken bottom scroll listener — Task 1.
- [x] Add top pull-to-refresh — Tasks 2, 4.
- [x] Add bottom loading indicator — Tasks 1, 3.
- [x] Full reload on PTR — Task 4 reuses `reload-home`.
- [x] Visual design and CSS — Task 3.
- [x] Unit tests — Task 5.
- [x] E2E tests — Task 6.
