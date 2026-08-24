import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Capacitor native bridge and the Capgo updater plugin
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) }
}));
vi.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: { notifyAppReady: vi.fn(() => Promise.resolve()) }
}));

import { initOtaUpdates } from '../otaUpdates';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

describe('initOtaUpdates', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReset().mockReturnValue(false);
    vi.mocked(CapacitorUpdater.notifyAppReady).mockReset().mockResolvedValue(undefined);
  });

  it('is a no-op on non-native platforms', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    initOtaUpdates();
    expect(CapacitorUpdater.notifyAppReady).not.toHaveBeenCalled();
  });

  it('notifies Capgo the bundle booted successfully on native platforms', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    initOtaUpdates();
    expect(CapacitorUpdater.notifyAppReady).toHaveBeenCalledTimes(1);
  });

  it('does not throw when notifyAppReady rejects', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(CapacitorUpdater.notifyAppReady).mockRejectedValue(new Error('boom'));
    expect(() => initOtaUpdates()).not.toThrow();
  });
});
