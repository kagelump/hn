import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../performance', () => ({
  perf: {
    update: vi.fn(),
    data: {}
  }
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
  CapacitorHttp: { get: vi.fn() }
}));

import { readLocalData } from '../data';
import { store } from '../../utils/storage';

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

function daysAgo(days: number): number {
  return Date.now() - days * ONE_DAY_MS;
}

describe('readLocalData visited-data pruning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes an entry when both timestamps are older than 7 days', () => {
    store.set('visited', {
      version: 2,
      '100': { a: daysAgo(8), c: daysAgo(9) }
    });

    readLocalData();
    vi.runAllTimers();

    const visited = store.get<Record<string, unknown>>('visited');
    expect(visited?.['100']).toBeUndefined();
    expect(visited?.version).toBe(2);
  });

  it('preserves a recent article timestamp', () => {
    const oneDayAgo = daysAgo(1);
    store.set('visited', {
      version: 2,
      '101': { a: oneDayAgo }
    });

    readLocalData();
    vi.runAllTimers();

    const visited = store.get<Record<string, unknown>>('visited');
    expect(visited?.['101']).toEqual({ a: oneDayAgo });
    expect(visited?.version).toBe(2);
  });

  it('keeps a recent comment and drops an old article on the same entry', () => {
    const tenDaysAgo = daysAgo(10);
    const twoDaysAgo = daysAgo(2);
    store.set('visited', {
      version: 2,
      '102': { a: tenDaysAgo, c: twoDaysAgo }
    });

    readLocalData();
    vi.runAllTimers();

    const visited = store.get<Record<string, unknown>>('visited');
    expect(visited?.['102']).toEqual({ c: twoDaysAgo });
    expect(visited?.version).toBe(2);
  });

  it('leaves the version key untouched', () => {
    store.set('visited', {
      version: 2,
      '103': { a: daysAgo(8) }
    });

    readLocalData();
    vi.runAllTimers();

    const visited = store.get<Record<string, unknown>>('visited');
    expect(visited?.version).toBe(2);
  });
});
