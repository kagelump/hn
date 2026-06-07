# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # tsc + vite build → dist/
npm test               # vitest run (single pass)
npm run test:watch     # vitest in watch mode
npm run lint           # eslint --max-warnings 0
npm run type-check     # tsc --noEmit
npm run dev            # vite dev server on port 3000
npm run test:e2e       # playwright against localhost:3000

# iOS build
npm run build && npx cap sync ios
# Then open ios/App/App.xcodeproj in Xcode and ⌘R
```

To run a single test file: `npx vitest run src/modules/__tests__/data.test.ts`

## Architecture

Vanilla TypeScript SPA — no framework, direct DOM manipulation via innerHTML. Pages are pre-defined `<div>` containers in `index.html` that get populated dynamically.

### Event-driven module system

The app uses a PubSub event bus (`src/utils/pubsub.ts`) to decouple modules. The router publishes events (`show-comments`, `show-article`, etc.) and page modules subscribe to them. Each page module follows this pattern:

1. Subscribe to its PubSub event in `init*()` called from `main.ts`
2. Call `showPage(pageClass)` to make its container visible (CSS transform slide)
3. Fetch data, render HTML into the container's `.bd` div

### Data layer (`src/modules/data.ts`)

- **Story lists**: HN Firebase API (`/v0/topstories.json` → batch fetch items by ID, 20 concurrent)
- **Comment trees**: Algolia API (`/api/v1/items/{id}`) — returns full tree in one request
- In-memory cache with 5-min TTL, visited tracking in localStorage with 7-day auto-pruning
- `AbortController` cancels in-flight fetches on navigation via `cancelPendingRequests()`

### Router (`src/modules/router.ts`)

Hash-based: `#/comments/123`, `#/article/456`, `#/settings`. Uses `history.pushState` + `popstate` listener. `showPage()` toggles `.show-page` class; CSS transforms handle slide transitions (400ms ease).

### Settings / theming (`src/modules/settings.ts`)

All persisted to localStorage. Applied to `<html>` element:
- `theme` → class `theme-{name}` (light/dark)
- `fontFamily` → inline `style.fontFamily` (self-hosted fonts in `public/fonts/`)
- `textSize` → inline `style.fontSize` (13–23px slider)
- `themeColor` → CSS custom property `--theme-color` (default `#ff6600`)
- `animation` → class `no-animation` disables all transitions

Settings are restored on startup in `main.ts` before any page renders.

### CSS structure

- `common.css` — base styles, `@font-face` declarations, `--theme-color`, loading spinner
- `pages.css` — page layout, transitions, all component styles
- `dark.css` — `.theme-dark` prefixed overrides (~160 lines)
- Safe areas handled via `env(safe-area-inset-top/bottom)`

## Key conventions

- **TypeScript strict mode** with `noUnusedLocals` and `noUnusedParameters`
- **Path alias**: `@/*` → `src/*` (tsconfig + vitest)
- **No framework** — render by setting `element.innerHTML` with template strings
- **HTML escaping**: `escapeHtml()` from `src/utils/template.ts` (DOM round-trip)
- **Template engine**: `prerender()` compiles `index.html` templates via `new Function()`
- **Native HTTP**: On iOS, reader mode uses `CapacitorHttp.get()` (no CORS); web falls back to configurable CORS proxy
- **Reader mode**: `@mozilla/readability` parses fetched HTML into clean content
- **Capacitor 8.4.0** for iOS — `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`

## Testing

- **Unit**: Vitest with jsdom, `src/test/setup.ts` mocks localStorage. Tests in `__tests__/` dirs co-located with source.
- **E2E**: Playwright in `e2e/app.spec.ts` (7 tests). Auto-starts dev server.
- Coverage thresholds: 80% lines, 68% branches, 80% functions.
