# HTML Comment Fallback When Algolia Is Unavailable

**Date:** 2026-08-24
**Status:** Approved

## Problem

The comments feature stopped working. Investigation of the live APIs showed the
Algolia HN Search API (`https://hn.algolia.com/api/v1/items/{id}`), which supplies
the full comment tree, has an indexing pipeline that is lagging ~14 hours behind.
Every current front-page story returns HTTP 404 from Algolia while existing fully on
the Firebase API. Because the front page is dominated by fresh stories, nearly every
comment tap 404s, `fetchAlgoliaItem` throws, and comments fail to load.

The response format is unchanged — this is purely an upstream Algolia availability
problem. The app should degrade gracefully instead of failing.

## Solution Overview

`getArticleComments` already fetches, in parallel:
1. The Algolia item (full comment tree with text), and
2. The HN HTML page (`news.ycombinator.com/item?id={id}`), used today only for
   comment ordering and downvote color classes.

The HN HTML page already contains the full text and structure of the comments visible
on that page. When Algolia cannot supply the tree, we build the comment tree from that
HTML instead and show a notice that we are displaying top comments only.

## Components

### 1. New parser: `extractHnComments(html, storyId): HNComment[]` (in `src/modules/data.ts`)

A sibling to the existing `extractHnPageData`. Walks `tr.comtr` rows in document order.
For each row it extracts:

- `id` — from the row's `id` attribute
- nesting depth — from `td.ind`'s `indent` attribute (0 = top-level)
- `user` — from `.hnuser`
- `time_ago` — from the `.age a` text (e.g. "12 hours ago")
- `content` — the `.commtext` element's `innerHTML`
- `colorClass` — the `cXX` class on `.commtext` (skip the default `c00`)

Reconstructs the nested `HNComment[]` tree with an indent-based stack: an indent `N+1`
row nests under the most recent indent `N` row.

Deleted/flagged rows (no `.commtext`) become placeholder nodes (`user: '[deleted]'`,
`content` = the row's visible text such as `[flagged]`/`[dead]`, or empty) so that the
nesting of any surviving replies stays correct.

Uses `DOMParser`, matching the existing `extractHnPageData` — jsdom-safe for unit tests.

### 2. Rework fetch handling in `getArticleComments`

- Make the Algolia fetch non-fatal, mirroring the existing HN-HTML `.catch`:
  `fetchAlgoliaItem(id, signal).catch(() => null)`.
- After both settle, branch:
  - **Algolia returned comments** → existing behavior unchanged: build the item from
    Algolia fields, use the Algolia tree, order + color it via the HN HTML page.
  - **Algolia null/empty AND HTML yields comments** → *fallback*:
    - `comments` = `extractHnComments(html, id)` (ordering and colors are inherent to
      the parse — no separate sort/color pass).
    - `sortWarning = 'Algolia is down — showing top comments only.'`
    - Story meta (title, points, author, time, url, `comments_count`) comes from the
      cached article via `getArticleById(id)` when present; otherwise a Firebase
      `fetchItem(id)` + `transformItem`. `comments_count` uses the real descendants
      count when available, else the parsed comment count.
  - **Neither source yields comments** → throw, preserving the existing
    "Failed to load comments." error UI.

### 3. UI — no changes

The `sortWarning` field already drives the header "!" button and its modal in
`src/modules/comments.ts`. In fallback mode the ordering is correct (it comes straight
from the HTML), so the single warning slot is repurposed to carry the outage notice.
No template or CSS changes are required.

## Data Flow

```
show-comments(id)
  └─ getArticleComments(id)
       ├─ Promise.all([ fetchAlgoliaItem(id).catch(()=>null),
       │                fetchHnPageHtml(id).catch(()=>'') ])
       ├─ algolia has comments? ── yes ─▶ Algolia tree, ordered/colored by HTML  (existing)
       ├─ else html has comments? ─ yes ─▶ extractHnComments(html) + sortWarning + meta(cache|firebase)
       └─ else ─▶ throw ─▶ "Failed to load comments."
```

## Error Handling / Edge Cases

- Both Algolia and HTML fail (or yield no comments) → throw → existing error UI.
- Firebase meta fetch fails during fallback → render comments with cached or minimal
  meta rather than failing the whole page.
- Deleted/flagged comment rows are preserved as placeholders to keep nesting intact.

## Testing

Vitest + jsdom, following existing patterns in
`src/modules/__tests__/data.test.ts` (`global.fetch` mock, Capacitor mock).

- `extractHnComments` against an HTML fixture → asserts correct nested tree, authors,
  color classes, content, and preserved nesting for a deleted row.
- `getArticleComments` fallback path → Algolia rejects (and separately: Algolia returns
  empty) + HTML fixture with comments ⇒ `article.comments` built from HTML,
  `sortWarning` set, meta present.
- Update the existing `throws when getArticleComments fetch fails` test so the HTML mock
  also yields no comments, keeping the "both sources fail ⇒ throw" contract valid.

## Out of Scope

- No Firebase-based full recursive comment tree (a heavier alternative fallback).
- No changes to story-list fetching, which already uses Firebase.
- No new UI affordance beyond the existing `sortWarning` "!" button.
