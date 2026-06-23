# Front Page Overscroll Gestures Design

**Date:** 2026-06-20  
**Scope:** Home page story list (`page-home`)  
**Status:** Approved

## Goal

Add mobile-style overscroll gestures to the front page story list:

1. **Pull down at the top** to refresh the list.
2. **Scroll to the bottom** to automatically load more stories, with a visible loading indicator.

## Background / Root Cause

The front page already had an "infinite scroll" implementation, but it was attached to the wrong DOM element. The scroll listener was bound to `.bd`, which is a non-scrolling child of `.pagebd-container`. The actual scroll container is `.pagebd-container` (it has `overflow-y: auto`). As a result, the scroll event never fired and more stories were never loaded automatically.

This design includes fixing that listener as part of the work.

## Decisions

- **Top overscroll:** custom pull-to-refresh (PTR) implementation rather than a Capacitor/native plugin, keeping the app web-first and cross-platform.
- **Bottom overscroll:** keep the existing near-bottom auto-load pattern (common in mobile feed apps) and add a clear loading indicator, rather than requiring an explicit pull-up gesture.
- **Full reload on PTR:** matches the current reload button behavior (`reload-home` → `getArticles(..., true)`).

## Architecture

### Components / Modules

| Component | Responsibility |
|-----------|----------------|
| `src/modules/pullToRefresh.ts` | New module. Tracks touch/scroll state on `.pagebd-container`, renders PTR indicator, and publishes `reload-home` when threshold is crossed. |
| `src/main.ts` `initHomePage()` | Fix scroll listener target to `.pagebd-container`; wire up `pullToRefresh.init()`; keep bottom auto-load logic. |
| `src/styles/pages.css` | Styles for `.pagebd-container` overscroll behavior, PTR indicator, and bottom load-more indicator. |
| `src/modules/data.ts` | No API changes; reuse `getArticles(reload=true)` and `loadMore()`. |

### Pull-to-Refresh Behavior

1. Listen for `touchstart` / `touchmove` / `touchend` on `.pagebd-container` (passive where possible, but `touchmove` may need `preventDefault` only when actively pulling).
2. Only activate when `scrollTop <= 0` and the user is pulling downward.
3. As the user pulls, translate the list content down via `transform: translateY(dy)` and reveal a spinner + label above it.
4. Use a threshold of ~60–80 px.
   - Below threshold: label reads "Pull to refresh".
   - Above threshold: label reads "Release to refresh".
5. On release above threshold: snap the indicator to a fixed loading position, publish `reload-home`, and wait for `renderList` to complete.
6. On complete: hide indicator and snap content back to `translateY(0)`.
7. If the user releases below threshold, snap back without reloading.

### Bottom Auto-Load Behavior

1. Attach a `scroll` listener to `.pagebd-container` (not `.bd`).
2. When `scrollHeight - scrollTop - clientHeight < 200` and not already loading:
   - Set `isLoadingMore = true`.
   - Append a bottom loading indicator `<li class="load-more-indicator">` to the list.
   - Call `data.loadMore()`.
3. On success: remove indicator, `appendList(items)`, reset `isLoadingMore = false`.
4. On error: remove indicator, reset flag, log error, and show an error via the existing loading UI.

### Touch Conflict Resolution

- The existing swipe-to-go-back gesture disables itself on the home page (`page-home.show-page`), so it will not conflict with PTR.
- PTR must only consume vertical touches at `scrollTop <= 0` and when horizontal delta is not dominant.
- Use `touch-action: pan-y` on `.pagebd-container` so the browser handles normal scrolling and we only intervene during overscroll.

## Data Flow

```
User pulls down at top
  → pullToRefresh detects overscroll
  → publishes 'reload-home'
  → initHomePage handler calls data.getArticles(callback, true)
  → data fetches fresh IDs, resets cache, fetches first page
  → callback invokes renderList(items)
  → pullToRefresh hides indicator

User scrolls near bottom
  → scroll listener on .pagebd-container
  → calls data.loadMore(callback)
  → data fetches next PAGE_SIZE items
  → callback invokes appendList(items)
  → removes bottom indicator, appends new items
```

## Error Handling

- **PTR reload failure:** hide the PTR indicator, show a non-blocking error status via the existing `loading` module, and leave the current list visible.
- **Bottom load failure:** remove the bottom indicator, reset `isLoadingMore`, log to console, and show status error. User can retry by scrolling again.
- **No more items:** if `pendingIds` is empty, `loadMore` returns immediately; do not show the bottom indicator in that case.

## Visual Design

- PTR indicator uses the existing `.show-loading .circle` spinner for consistency.
- Label text uses the existing font stack and theme color (`--theme-color`).
- Indicator height ~60–80 px; content translation matches pull distance with a damping factor (e.g. `dy * 0.5`) so it feels elastic.
- Bottom indicator is a centered spinner inside a full-width list item.
- Add `overscroll-behavior-y: contain` to `.pagebd-container` to prevent the body from scrolling during overscroll gestures.

## Testing

### Unit Tests

- Add `src/modules/__tests__/pullToRefresh.test.ts`:
  - Does not trigger when not at top.
  - Triggers reload when threshold is crossed.
  - Snaps back without reload when below threshold.
  - Hides indicator on completion.

### E2E Tests

- Add to `e2e/app.spec.ts`:
  - **Infinite scroll:** load home, scroll `.pagebd-container` to bottom, verify list count increases beyond 30.
  - **Pull-to-refresh:** simulate pull-down gesture on `.pagebd-container`, verify spinner appears and list reloads.

### Manual Verification

- iOS Safari / Capacitor: check rubber-band behavior, ensure PTR works, no gesture conflicts.
- Android Chrome: verify overscroll glow does not fight the PTR indicator.
- Desktop: ensure scroll wheel still loads more near bottom and PTR is not triggered accidentally.

## Files to Change

- `src/main.ts` — fix scroll listener target, init PTR, bottom indicator insertion/removal.
- `src/modules/pullToRefresh.ts` — new module.
- `src/styles/pages.css` — PTR and bottom indicator styles, overscroll-behavior.
- `e2e/app.spec.ts` — new E2E tests.
- `src/modules/__tests__/pullToRefresh.test.ts` — new unit tests.

## Out of Scope

- Native iOS/Android pull-to-refresh plugins.
- Pull-up-to-load-more explicit gesture (using auto-load instead).
- Changing pagination size or API endpoints.
