import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { config } from '../config';

export async function renderVersionInfo(element: HTMLElement): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    element.textContent = `Web ${config.version}`;
    return;
  }

  element.textContent = 'App … · OTA …';
  const [app, ota] = await Promise.allSettled([
    Promise.resolve().then(() => App.getInfo()),
    // Read the running bundle, not a downloaded update queued for next launch.
    Promise.resolve().then(() => CapacitorUpdater.current())
  ]);

  const appLabel = app.status === 'fulfilled'
    ? `${app.value.version} (build ${app.value.build})`
    : 'unavailable';
  const otaLabel = ota.status === 'fulfilled'
    ? ota.value.bundle.version === 'builtin'
      ? 'none (bundled)'
      : ota.value.bundle.version
    : 'unavailable';

  element.textContent = `App ${appLabel} · OTA ${otaLabel}`;
}
