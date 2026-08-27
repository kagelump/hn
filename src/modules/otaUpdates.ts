// Over-the-air (OTA) web-bundle updates.
//
// The native updater still calls notifyAppReady() as the rollback safety valve.
// Bundle discovery is hosted independently: a static manifest on GitHub Pages
// points at a versioned ZIP in GitHub Releases. A newer compatible bundle is
// downloaded in the background and queued for the next background/restart.
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export const GITHUB_OTA_MANIFEST_URL = 'https://kagelump.github.io/hn/ota/latest.json';
const APP_ID = 'com.raycatdev.hn';
const MANIFEST_TIMEOUT_MS = 10_000;

export interface GithubOtaManifest {
  schema: 1;
  appId: string;
  version: string;
  minimumNativeVersion: string;
  url: string;
  checksum: string;
  publishedAt: string;
}

export type GithubOtaCheckResult =
  | 'queued'
  | 'up-to-date'
  | 'incompatible'
  | 'invalid-manifest'
  | 'failed';

function parseVersion(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) throw new Error(`Invalid OTA version comparison: ${left}, ${right}`);

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseGithubOtaManifest(value: unknown): GithubOtaManifest | null {
  if (!isRecord(value) || value.schema !== 1 || value.appId !== APP_ID) return null;

  const { version, minimumNativeVersion, url, checksum, publishedAt } = value;
  if (typeof version !== 'string' || !parseVersion(version) ||
      typeof minimumNativeVersion !== 'string' || !parseVersion(minimumNativeVersion) ||
      typeof url !== 'string' || typeof checksum !== 'string' ||
      typeof publishedAt !== 'string' || Number.isNaN(Date.parse(publishedAt)) ||
      !/^[a-f0-9]{64}$/i.test(checksum)) {
    return null;
  }

  try {
    const releaseUrl = new URL(url);
    const expectedPath = `/kagelump/hn/releases/download/ota-${version}/hn-reader-${version}.zip`;
    if (releaseUrl.protocol !== 'https:' || releaseUrl.hostname !== 'github.com' ||
        releaseUrl.pathname !== expectedPath || releaseUrl.search || releaseUrl.hash) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    schema: 1,
    appId: APP_ID,
    version,
    minimumNativeVersion,
    url,
    checksum: checksum.toLowerCase(),
    publishedAt
  };
}

async function fetchGithubOtaManifest(): Promise<GithubOtaManifest | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);

  try {
    const separator = GITHUB_OTA_MANIFEST_URL.includes('?') ? '&' : '?';
    const response = await fetch(`${GITHUB_OTA_MANIFEST_URL}${separator}t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Manifest request failed with ${response.status}`);
    return parseGithubOtaManifest(await response.json());
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function checkGithubOtaUpdate(): Promise<GithubOtaCheckResult> {
  try {
    const [manifest, builtin, current, downloaded] = await Promise.all([
      fetchGithubOtaManifest(),
      CapacitorUpdater.getBuiltinVersion(),
      CapacitorUpdater.current(),
      CapacitorUpdater.list()
    ]);

    if (!manifest) return 'invalid-manifest';

    const nativeVersion = builtin.version;
    if (compareVersions(nativeVersion, manifest.minimumNativeVersion) < 0) {
      console.info(`[GitHub OTA] ${manifest.version} requires native ${manifest.minimumNativeVersion}`);
      return 'incompatible';
    }

    const currentVersion = current.bundle.version === 'builtin'
      ? nativeVersion
      : current.bundle.version;
    if (compareVersions(manifest.version, currentVersion) <= 0) return 'up-to-date';

    const existing = downloaded.bundles.find(bundle => bundle.version === manifest.version);
    const bundle = existing || await CapacitorUpdater.download({
      version: manifest.version,
      url: manifest.url,
      checksum: manifest.checksum
    });

    await CapacitorUpdater.next({ id: bundle.id });
    console.info(`[GitHub OTA] ${manifest.version} downloaded and queued`);
    return 'queued';
  } catch (error) {
    console.warn('[GitHub OTA] update check failed:', error);
    return 'failed';
  }
}

export function initOtaUpdates(): void {
  // Web/dev (and the jsdom test environment) have no native plugin.
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Signal readiness before doing network work. A freshly activated bundle
    // that never reaches this call is rolled back by the native plugin.
    void CapacitorUpdater.notifyAppReady().catch((err) => {
      console.warn('[OTA] notifyAppReady failed:', err);
    });
  } catch (err) {
    console.warn('[OTA] notifyAppReady threw synchronously:', err);
  }

  void checkGithubOtaUpdate();
}
