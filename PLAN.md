# HN Reader Modernization — Master Plan

## Overview

Migrate from dead proprietary API to the official HN Firebase API, clean up all legacy/dead code, add comprehensive tests, port remaining missing features, and adopt modern idioms throughout.

---

## Phase 1: API Migration to Firebase + Data Layer Rewrite

**Goal:** Replace the dead `localhost:8080` mock API with `https://hacker-news.firebaseio.com/v0/` and rewrite the data layer to match the new API shape.

### 1a. Config cleanup (`src/config.ts`)
- Replace `url.stories` with `'https://hacker-news.firebaseio.com/v0'`
- Remove `url.storiesBackup` (Firebase has no backup server concept)
- Remove dead fields: `nativeApp`, `iScrollEnable`, `apikey`, `url.share`, `url.readability`
- Remove `js-cookie` import — hnid migration from cookie is done; use `storage.ts` only
- Strip `AppConfig` type down to what's actually used

### 1b. New Firebase API types (`src/types/index.ts`)
The Firebase API returns a different shape than the legacy API:

| Firebase field | Legacy field | Notes |
|---|---|---|
| `by` | `user` | Author username |
| `score` | `points` | Upvote count |
| `descendants` | `comments_count` | Total comment count |
| `time` | `time_ago` | Unix timestamp (compute `time_ago` client-side) |
| `kids` | `comments` | Array of IDs, not objects (fetch recursively) |
| — | `domain` | Extract from `url` hostname |
| — | `self` | Infer: `self` if no `url` or `type === 'story'` with `text` |

- Define `FirebaseItem` interface for raw API responses
- Keep `HNItem` / `HNComment` as the app-facing types (add transform layer)
- Remove unused fields from `AppConfig` (`nativeApp`, `iScrollEnable`, `apikey`)

### 1c. Data layer rewrite (`src/modules/data.ts`)
- **Story lists:** Fetch ID arrays from `/topstories.json`, `/newstories.json`, `/askstories.json`, `/showstories.json`, `/jobstories.json`; then batch-fetch items by ID
- **Single item:** Fetch from `/item/{id}.json`
- **Comment tree:** Fetch item, then recursively fetch each `kids[]` ID (with concurrency limit to avoid hammering the API)
- **Transform layer:** `FirebaseItem` → `HNItem` (compute `time_ago`, `domain`, `self`, remap field names)
- **Remove:** All ThriftDB URL templates, `viewText` URL template, `reformatData()`, server failover logic (Firebase is a single reliable endpoint), JSONP-related code
- **Remove:** `getArticleContent()` entirely (readability proxy is dead; link directly to articles)
- **Implement:** `getArticlesByType(type)` using Firebase category endpoints
- **Keep:** In-memory cache, localStorage cache (5-min TTL), visited tracking, debounce save, 7-day pruning

### 1d. Remove `js-cookie` dependency
- `src/config.ts` — remove cookie migration code (hnid migration is done)
- `src/main.ts` — replace `Cookies.get()` calls with `store.get()` from `storage.ts`
- `package.json` — remove `js-cookie` and `@types/js-cookie`

---

## Phase 2: Delete All Dead Weight

**Goal:** Remove everything that's no longer referenced or needed.

### Files to delete
| Path | Reason |
|---|---|
| `a/` (entire directory) | Legacy JS/CSS/icons/fonts — not referenced by modern build |
| `index.htm` | Legacy HTML entry point — superseded by `index.html` |
| `mock-api-server.js` | Mock API server — no longer needed with Firebase |
| `public/glyph/lte-ie7.js` | IE7 compatibility script — irrelevant |
| `a/read/sample.txt` | Readability proxy sample — feature removed |

### Code to remove from remaining files
- **`src/main.ts`**: Remove entire `window.$hn` global export (lines 37–61) and `declare global` block
- **`src/modules/data.ts`**: Remove dead URL templates (`viewText`, ThriftDB), server failover logic, `changeServer()`
- **`src/config.ts`**: Remove dead config fields (see 1a)
- **`src/types/index.ts`**: Remove dead fields from `AppConfig`

---

## Phase 3: Testing — Vitest + High Coverage

**Goal:** Set up Vitest (natural fit since Vite is already the bundler) with high coverage targets.

### 3a. Setup
- Install: `vitest`, `@vitest/coverage-v8`, `jsdom` (for DOM testing)
- Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`
- Create `vitest.config.ts` extending `vite.config.ts`
- Coverage thresholds: **80% lines, 80% branches, 80% functions** as a starting floor

### 3b. Test files to create
| Module | Test file | Key cases |
|---|---|---|
| `src/utils/template.ts` | `src/utils/__tests__/template.test.ts` | `prerender()` compiles templates, `template()` simple replacement, `escapeHtml()` escapes all XSS vectors |
| `src/utils/time.ts` | `src/utils/__tests__/time.test.ts` | "Just now", minutes, hours, date formatting, edge cases |
| `src/utils/storage.ts` | `src/utils/__tests__/storage.test.ts` | get/set/remove, JSON serialization, error handling |
| `src/utils/pubsub.ts` | `src/utils/__tests__/pubsub.test.ts` | subscribe/publish, multiple subscribers, unsubscribe |
| `src/modules/data.ts` | `src/modules/__tests__/data.test.ts` | Fetch mocking (MSW or vi.fn), cache hit/miss, visited tracking, localStorage persistence, type filtering, error handling |
| `src/modules/performance.ts` | `src/modules/__tests__/performance.test.ts` | Timing updates, data structure |
| `src/modules/ui.ts` | `src/modules/__tests__/ui.test.ts` | Loading indicator show/hide |
| `src/main.ts` | `src/__tests__/main.test.ts` | Integration: init flow, click handlers, page rendering |

### 3c. Test utilities
- Create `src/test/setup.ts` for jsdom environment setup
- Mock `fetch` globally for data layer tests
- Mock `localStorage` for storage tests

---

## Phase 4: Port Missing Features

**Goal:** Bring the modern app to feature parity with the legacy app.

### 4a. Page router (`src/modules/router.ts` — new file)
- Generic `showPage(pageClass)` function: remove `.show-page` from current, add to target
- Publish `onPageHidden` on page leave (for DOM cleanup)
- Update `document.title`
- Hash-based routing: `#/comments/{id}`, `#/article/{id}`
- `history.pushState` integration with `popstate` handler

### 4b. Comments page (`src/modules/comments.ts` — new file)
- Fetch comment tree from Firebase API (recursive `kids[]` fetching)
- Recursive `getCommentsHtml()` rendering
- Highlight OP comments with `op` CSS class
- Track last-read comment, mark older comments as `comment-visited`
- Show original post text (`.op-comment`) if article has `text`
- Tap-to-mark-visited on comments
- DOM cleanup on page hide

### 4c. Article content page (`src/modules/article.ts` — new file)
- Since the readability proxy is dead, link directly to external URLs
- For Ask HN / Show HN posts with `text`, render the self-text content
- DOM cleanup on page hide

### 4d. Settings page (`src/modules/settings.ts` — new file)
- Theme picker (swap `theme-*` class on `<html>`)
- Font size picker (swap `font-*` class)
- Auto-hide read comments toggle
- Persist all to localStorage (drop cookies entirely)
- Display app version

### 4e. About page + Performance page
- Simple static renders from templates
- Performance page: display `perf.data` as key/value pairs

### 4f. Filter views
- Wire submenu filter links to `getArticlesByType()`
- Filters: Front Page, Ask HN, Show HN, Top 10 (Today/Yesterday/Week)

### 4g. Menu/submenu + header navigation
- Toggle submenu on settings icon click
- Back-home button in sub-pages
- Reload button on home page

---

## Phase 5: Modern Idioms & Polish

**Goal:** Make the code feel like it was written today, not 13 years ago.

### 5a. Drop legacy patterns
- Remove `js-cookie` — use `localStorage` only via `storage.ts`
- Remove `template()` / `prerender()` string template engine — use direct DOM manipulation or tagged template literals
- Remove `PubSub` — use native `CustomEvent` / `EventTarget` or a tiny typed event emitter
- Remove `window.$hn` global entirely

### 5b. Modern TypeScript patterns
- Use `satisfies` operator where applicable
- Use `as const` assertions for config constants
- Prefer `unknown` over `any` (audit for `any` usage)
- Use discriminated unions for item types (story vs comment vs job)
- Use `Readonly` / `ReadonlyArray` for immutable data

### 5c. Modern DOM patterns
- Use `document.createElement` / DOM APIs instead of innerHTML where possible
- Use `AbortController` for cancellable fetches (page navigation cancels in-flight requests)
- Use `structuredClone()` for deep copies instead of `JSON.parse(JSON.stringify())`

### 5d. Build & lint
- Update ESLint config to flat config format (ESLint 9+)
- Add Prettier for formatting consistency
- Update `tsconfig.json` target to `ES2022` (current is `ES2020`)

---

## Execution Order

```
Phase 1 (API)  →  Phase 2 (Cleanup)  →  Phase 3 (Tests)  →  Phase 4 (Features)  →  Phase 5 (Polish)
     ↓                  ↓                     ↓                     ↓                      ↓
  Data layer        Delete dead           Vitest setup         Port pages           Drop legacy
  works with        files + code          + write tests        + routing            patterns,
  Firebase                               for existing         + all pages          modernize
                                         code first                                idioms
```

**Phase 1 + 2** can be done together (switch API, then delete old code).
**Phase 3** should happen before Phase 4 — write tests for existing code first, then test-drive the new features.
**Phase 4** is the biggest chunk — porting 5 pages + routing.
**Phase 5** is cleanup/polish that can happen incrementally.

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Test framework | Vitest | Already using Vite; zero-config integration, fast |
| Coverage target | 80% all metrics | High but achievable; pragmatically higher for utils/data |
| Readability proxy | Remove entirely | Dead service; link to articles directly |
| Template engine | Replace with DOM APIs | Modern browsers don't need string template compilation |
| PubSub | Replace with CustomEvent | Native API, no dependency needed |
| Cookies | Replace with localStorage | One storage mechanism, simpler |
| Firebase concurrency | Max 5 parallel fetches for comment trees | Respect rate limits, keep UI responsive |
