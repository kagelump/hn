// Over-the-air (OTA) web-bundle updates via Capgo.
//
// The native plugin (autoUpdate) checks Capgo on launch/resume, downloads newer
// bundles in the background, and activates them on the next cold start. Its one
// requirement of the web layer is that a freshly-booted bundle calls
// notifyAppReady(): if a downloaded bundle throws before doing so, Capgo reverts
// to the previous known-good bundle on the next launch. That makes this the
// rollback safety valve — it must run on the successful-boot path.
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export function initOtaUpdates(): void {
  // Web/dev (and the jsdom test env) have no native plugin — nothing to do.
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Fire-and-forget: signal that this bundle booted successfully so Capgo
    // won't roll it back. Never let a failure here break app start.
    void CapacitorUpdater.notifyAppReady().catch((err) => {
      console.warn('[OTA] notifyAppReady failed:', err);
    });
  } catch (err) {
    console.warn('[OTA] notifyAppReady threw synchronously:', err);
  }
}
