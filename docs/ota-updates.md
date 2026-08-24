# OTA Updates (Capgo) — Runbook

The iOS app ships web-only fixes over-the-air with [Capgo](https://capgo.app), so
changes under `src/` (the `dist/` bundle) can reach users **without an App Store
review**. This is permitted by Apple's Developer Program License Agreement §3.3.2
because Capacitor runs the bundle in WebKit/JavaScriptCore.

**Scope:** web-bundle changes only. A native/Swift change, a Capacitor upgrade, or a
plugin add/upgrade still requires a normal App Review build.

---

## How it works

- `capacitor.config.ts` enables `CapacitorUpdater.autoUpdate`. On launch/resume the
  native plugin checks the Capgo `production` channel, downloads a newer bundle in the
  background, and activates it on the **next cold start**.
- On every successful boot, `src/modules/otaUpdates.ts` calls
  `CapacitorUpdater.notifyAppReady()`. If a downloaded bundle throws before that call,
  Capgo automatically **rolls back** to the previous known-good bundle. Do not remove
  this call.

---

## One-review constraint (read once)

OTA can only update a build that already contains the Capgo plugin. So:

1. The plugin is wired in (done).
2. Ship **one** App Review build that contains it (normal or
   [expedited](https://developer.apple.com/contact/app-store/?topic=expedite)).
3. After that, every web-only fix goes out with `npm run ota:ios` — no review.

---

## One-time setup (requires your Capgo API key)

Run these once. They need your account and are **not** run by CI or by the assistant.

```bash
# 1. Authenticate the CLI (get the key from https://web.capgo.app account settings)
npx @capgo/cli login <YOUR_CAPGO_API_KEY>

# 2. Register this app in Capgo
npx @capgo/cli app add com.raycatdev.hn

# 3. Create the production channel and make it the default auto-update channel
npx @capgo/cli channel add production com.raycatdev.hn
npx @capgo/cli channel set production com.raycatdev.hn --default --downgrade --upgrade
```

---

## Publish a web-only update

After merging a web-only fix:

```bash
npm run ota:ios
```

This builds `dist/` and uploads it to the `production` channel. Devices pick it up on
their next launch/resume and activate it on the following cold start.

Tie the bundle version to a semver so rollbacks are addressable:

```bash
npm run build && npx @capgo/cli bundle upload --channel production --bundle 1.0.2
```

---

## Verify / roll back

```bash
# List uploaded bundles
npx @capgo/cli bundle list com.raycatdev.hn

# Force the channel back to a previous bundle
npx @capgo/cli channel set production com.raycatdev.hn --bundle <previous-version>
```

---

## Local native verification (no account needed)

```bash
npm run build && npx cap sync ios
# open ios/App/App.xcodeproj in Xcode and ⌘R
```

`cap sync` registers the plugin through Swift Package Manager
(`ios/App/CapApp-SPM/Package.swift` gains a `CapgoCapacitorUpdater` entry — this repo
uses SPM, not CocoaPods). The app should boot normally; on a store/dev build
`notifyAppReady()` runs against the built-in bundle as a harmless no-op.
