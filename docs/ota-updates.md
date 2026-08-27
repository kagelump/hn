# OTA Updates (GitHub) — Runbook

HN Reader distributes web-only updates from this public GitHub repository:

- GitHub Releases stores each immutable ZIP bundle.
- GitHub Pages serves `docs/ota/latest.json`, the small manifest that points to the
  newest compatible release and includes its SHA-256 checksum.
- `src/modules/otaUpdates.ts` checks that manifest on native app startup, downloads a
  newer bundle in the background, verifies it, and queues it for the next background
  or restart.
- `CapacitorUpdater.notifyAppReady()` remains the rollback safety valve. Do not remove
  it: an update that cannot finish booting is automatically reverted.

This does not require a Capgo subscription. The Capgo updater package remains in the
app as the native ZIP installer, but its hosted update checks and telemetry are
disabled in `capacitor.config.ts` for future App Store builds.

**Scope:** OTA is only for files produced in `dist/`. Swift/native changes, Capacitor
or plugin upgrades, permissions, entitlements, and other native behavior require a
normal App Store release.

## Publish an update

1. Make and verify the web-only change.
2. Increase the patch version in both `package.json` and `package-lock.json`.
3. Commit and push the change to `master`.
4. Run:

   ```bash
   npm run ota:ios
   ```

The `Publish GitHub-hosted OTA update` workflow runs lint, type checking, tests, and
the production build. It then:

1. creates `hn-reader-<version>.zip` with `index.html` at the ZIP root;
2. creates the immutable `ota-<version>` GitHub Release;
3. computes the ZIP's SHA-256 checksum;
4. commits the new `docs/ota/latest.json` manifest to `master`; and
5. deploys `docs/` to GitHub Pages.

Do not reuse a version. The workflow refuses to overwrite an existing release.

## Version compatibility

Every manifest includes `minimumNativeVersion`. The workflow prompt defaults to
`1.0.1`; increase it when a bundle depends on a newer App Store build. Devices below
that version ignore the update.

OTA versions must be strict `major.minor.patch` values and must increase monotonically.
When publishing a new native build, set its `MARKETING_VERSION` and package version
above every OTA version released so far.

## Verify a publication

- Open the workflow run and confirm all verification and deployment steps passed.
- Open `https://kagelump.github.io/hn/ota/latest.json` and confirm its version.
- Open the matching `ota-<version>` release and confirm the ZIP is attached.
- On a device, launch once to download, background or restart to activate, then launch
  again so `notifyAppReady()` marks the bundle healthy.

GitHub Pages may cache the manifest for several minutes. The app uses a cache-busting
query parameter, but intermediate caches can still introduce a short delay.

## Rollback

If an update cannot boot far enough to call `notifyAppReady()`, the native plugin
automatically restores the last healthy bundle.

For a functional regression that still boots, restore the known-good source, increase
the patch version, and publish it as a new OTA release. The app intentionally does not
downgrade to a lower version from the manifest.

If necessary, stop distribution immediately by moving or removing
`docs/ota/latest.json`; update checks will fail safely and the current bundle remains
installed. Removing a GitHub Release alone is not sufficient if the manifest still
points to it.

## One-time migration from Capgo Cloud

Installed version `1.0.1` still has native Capgo Cloud checks enabled. Bundle `1.0.3`
is published once to its existing Capgo `production` channel so those installations
receive the GitHub-manifest updater. After `1.0.3` activates, future updates come from
GitHub even if the Capgo trial or account expires.

The migration-only command is retained for disaster recovery, not normal releases:

```bash
npm run ota:capgo:bootstrap
```

A future App Store build generated from the current `capacitor.config.ts` disables the
old automatic Capgo endpoint and its stats endpoint completely.

## Local native verification

```bash
npm run build && npx cap sync ios
npm run check:spm
# Open ios/App/App.xcodeproj in Xcode and run the app.
```

Commit the regenerated native configuration and SwiftPM lockfile if they change.
