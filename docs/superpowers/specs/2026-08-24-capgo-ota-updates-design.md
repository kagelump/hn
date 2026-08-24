# Capgo OTA Updates for iOS

**Date:** 2026-08-24
**Status:** Approved

## Problem

The app is a Capacitor 7 iOS app whose logic lives entirely in the web bundle
(`dist/`). A web-only bug (e.g. the Algolia comment outage fixed in
`2026-08-24-html-comment-fallback-design.md`) currently requires a full App Store
binary submission and review to reach users. Apple's Developer Program License
Agreement §3.3.2 permits over-the-air updates of interpreted code running in
WebKit/JavaScriptCore, which Capacitor uses. Integrating an OTA mechanism lets
future web-only fixes ship without App Review.

## Decisions (locked)

- **Backend:** Capgo Cloud (managed). The account, API key, app registration, and
  channel are created by the user; this work wires the client to consume it.
- **Apply timing:** On next launch — background download, activate on next cold start
  (`autoUpdate: true`, no forced reload).
- **Platforms:** iOS only. Android is left untouched this round.

## The one-review constraint

OTA can only update a build that already contains the OTA plugin. Therefore:

1. This change is wired into the app.
2. The user ships **one** normal (or expedited) App Review build containing the plugin
   and `notifyAppReady()`.
3. Every subsequent web-only fix is published with `npm run ota:ios` and reaches users
   on next launch — no review.

This is inherent to OTA and cannot be avoided; it is documented, not solved.

## Components

### 1. Dependency

- Add `@capgo/capacitor-updater@7.50.2` (the `lts-v7` line; peer dep
  `@capacitor/core >=7.0.0`) to `dependencies`. The 8.x/9/10 lines require
  Capacitor 8 and must not be used.

### 2. Capacitor config (`capacitor.config.ts`)

```ts
plugins: {
  CapacitorUpdater: {
    autoUpdate: true
  }
}
```

`autoUpdate: true` makes the native plugin check Capgo on launch/resume, download in
the background, and activate the new bundle on the next cold start. No `directUpdate`
/ forced reload — matching the "on next launch" decision.

### 3. OTA readiness module (`src/modules/otaUpdates.ts`)

A small, isolated unit with one job: signal to Capgo that the current bundle booted
successfully.

- Exports `initOtaUpdates(): void`.
- No-op on non-native platforms (`Capacitor.isNativePlatform()` guard) so web/dev and
  the jsdom test environment are unaffected.
- On native, calls `CapacitorUpdater.notifyAppReady()`, wrapped in try/catch with a
  `console.warn` on failure (never let it break app start).

`notifyAppReady()` is Capgo's rollback safety valve: if a freshly-downloaded bundle
throws before calling it, the plugin reverts to the previous known-good bundle on the
next launch. This is why the call must sit on the successful-boot path.

### 4. Wire into startup (`src/main.ts`)

Call `initOtaUpdates()` from `init()`, after the page/router initialization that
constitutes a successful boot.

### 5. Publish workflow

- `package.json` script:
  `"ota:ios": "npm run build && npx @capgo/cli bundle upload --channel production"`
- Runbook at `docs/ota-updates.md` covering:
  - One-time user setup (commands needing the user's key):
    `npx @capgo/cli login <KEY>`, `npx @capgo/cli app add com.raycatdev.hn`,
    create a `production` channel set to default + auto-update.
  - Per-release: `npm run ota:ios`.
  - The one-review constraint and the rollback behavior.
  - Note that a native/Swift change (or a Capacitor/plugin upgrade) still requires a
    normal App Review build — only web-bundle changes go OTA.

### 6. Native install

- `npx cap sync ios` installs the CocoaPod and registers the plugin (updates
  `ios/App/Podfile.lock` and the Pods project). No manual Swift.

## Data Flow

```
App launch (native)
  └─ WKWebView loads active bundle (store bundle, or a downloaded OTA bundle)
       └─ main.ts init() → initOtaUpdates() → CapacitorUpdater.notifyAppReady()
                                               └─ marks bundle good (cancels rollback)
  └─ plugin (autoUpdate) checks Capgo channel in background
       └─ newer bundle? download → stage → activate on NEXT cold start
```

## Error Handling

- `notifyAppReady()` failure → caught + warned; app continues.
- Non-native platform → module is a no-op; web build behaves exactly as today.
- Broken OTA bundle (never calls `notifyAppReady`) → Capgo auto-rolls back.

## Testing

- **Unit (Vitest/jsdom):** `initOtaUpdates()` is a no-op when
  `Capacitor.isNativePlatform()` is false (asserts `notifyAppReady` not called), and
  calls `notifyAppReady()` once when native. `@capgo/capacitor-updater` is mocked,
  mirroring the existing `@capacitor/core` mock in `data.test.ts`.
- **Build/native verification (this session):** `npm run build`, `npm run type-check`,
  `npm run lint`, and `npx cap sync ios` all succeed; the plugin appears in the iOS
  Pods project.
- **Live OTA verification (user, out of this session):** requires the user's Capgo
  account and a device/TestFlight build. Documented in the runbook; cannot be done
  here because it needs account credentials and bundle upload to Capgo servers.

## Out of Scope

- Android OTA.
- Forced/immediate update reloads and update-available UI prompts.
- Self-hosted update backend.
- CI automation of `ota:ios` (documented as a manual step for now).
