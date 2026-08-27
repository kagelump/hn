import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) }
}));
vi.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: {
    notifyAppReady: vi.fn(() => Promise.resolve()),
    getBuiltinVersion: vi.fn(() => Promise.resolve({ version: '1.0.1' })),
    current: vi.fn(() => Promise.resolve({
      bundle: { id: 'builtin', version: 'builtin', downloaded: '', checksum: '', status: 'success' }
    })),
    list: vi.fn(() => Promise.resolve({ bundles: [] })),
    download: vi.fn(() => Promise.resolve({
      id: 'downloaded-1.0.3', version: '1.0.3', downloaded: '', checksum: '', status: 'pending'
    })),
    next: vi.fn(() => Promise.resolve())
  }
}));

import {
  checkGithubOtaUpdate,
  compareVersions,
  initOtaUpdates,
  parseGithubOtaManifest
} from '../otaUpdates';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

const manifest = {
  schema: 1,
  appId: 'com.raycatdev.hn',
  version: '1.0.3',
  minimumNativeVersion: '1.0.1',
  url: 'https://github.com/kagelump/hn/releases/download/ota-1.0.3/hn-reader-1.0.3.zip',
  checksum: 'a'.repeat(64),
  publishedAt: '2026-08-27T12:00:00.000Z'
};

describe('initOtaUpdates', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReset().mockReturnValue(false);
    vi.mocked(CapacitorUpdater.notifyAppReady).mockReset().mockResolvedValue(undefined);
    vi.mocked(CapacitorUpdater.getBuiltinVersion).mockReset().mockResolvedValue({ version: '1.0.1' });
    vi.mocked(CapacitorUpdater.current).mockReset().mockResolvedValue({
      bundle: { id: 'builtin', version: 'builtin', downloaded: '', checksum: '', status: 'success' }
    });
    vi.mocked(CapacitorUpdater.list).mockReset().mockResolvedValue({ bundles: [] });
    vi.mocked(CapacitorUpdater.download).mockReset().mockResolvedValue({
      id: 'downloaded-1.0.3', version: '1.0.3', downloaded: '', checksum: '', status: 'pending'
    });
    vi.mocked(CapacitorUpdater.next).mockReset().mockResolvedValue(undefined as never);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(manifest), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a no-op on non-native platforms', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    initOtaUpdates();
    expect(CapacitorUpdater.notifyAppReady).not.toHaveBeenCalled();
  });

  it('notifies the native updater that the bundle booted successfully', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    initOtaUpdates();
    expect(CapacitorUpdater.notifyAppReady).toHaveBeenCalledTimes(1);
  });

  it('does not throw when notifyAppReady rejects', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(CapacitorUpdater.notifyAppReady).mockRejectedValue(new Error('boom'));
    expect(() => initOtaUpdates()).not.toThrow();
  });

  it('compares semantic OTA versions numerically', () => {
    expect(compareVersions('1.0.10', '1.0.2')).toBeGreaterThan(0);
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.1.9', '1.2.0')).toBeLessThan(0);
  });

  it('rejects manifests outside this repository release path', () => {
    expect(parseGithubOtaManifest({ ...manifest, url: 'https://example.com/update.zip' })).toBeNull();
    expect(parseGithubOtaManifest({ ...manifest, version: '1.0.4' })).toBeNull();
    expect(parseGithubOtaManifest({ ...manifest, checksum: 'bad' })).toBeNull();
  });

  it('downloads and queues a newer compatible GitHub release', async () => {
    const result = await checkGithubOtaUpdate();

    expect(result).toBe('queued');
    expect(CapacitorUpdater.download).toHaveBeenCalledWith({
      version: '1.0.3',
      url: manifest.url,
      checksum: manifest.checksum
    });
    expect(CapacitorUpdater.next).toHaveBeenCalledWith({ id: 'downloaded-1.0.3' });
  });

  it('does not download when the current bundle is already up to date', async () => {
    vi.mocked(CapacitorUpdater.current).mockResolvedValue({
      bundle: { id: 'active', version: '1.0.3', downloaded: '', checksum: '', status: 'success' }
    });

    expect(await checkGithubOtaUpdate()).toBe('up-to-date');
    expect(CapacitorUpdater.download).not.toHaveBeenCalled();
  });

  it('does not download a bundle requiring a newer native app', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ...manifest,
      minimumNativeVersion: '1.0.2'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    expect(await checkGithubOtaUpdate()).toBe('incompatible');
    expect(CapacitorUpdater.download).not.toHaveBeenCalled();
  });

  it('reuses an already-downloaded bundle instead of downloading it again', async () => {
    vi.mocked(CapacitorUpdater.list).mockResolvedValue({
      bundles: [{
        id: 'existing-1.0.3', version: '1.0.3', downloaded: '', checksum: '', status: 'pending'
      }]
    });

    expect(await checkGithubOtaUpdate()).toBe('queued');
    expect(CapacitorUpdater.download).not.toHaveBeenCalled();
    expect(CapacitorUpdater.next).toHaveBeenCalledWith({ id: 'existing-1.0.3' });
  });
});
