import { describe, it, expect, beforeEach } from 'vitest';
import { perf } from '../performance';

describe('PerformanceTracker', () => {
  beforeEach(() => {
    // Reset perf data between tests
    perf.data.insertedNodeCount = 0;
  });

  it('has initial insertedNodeCount of 0', () => {
    expect(perf.data.insertedNodeCount).toBe(0);
  });

  it('stores timing data with type and time', () => {
    perf.update('test-id', 'fetch', 150);
    const entry = perf.data['test-id'];
    expect(typeof entry).toBe('object');
    expect((entry as Record<string, string>).fetch).toBe('150');
  });

  it('appends multiple timings for the same id and type', () => {
    perf.update('list', 'fetch', 100);
    perf.update('list', 'fetch', 200);
    const entry = perf.data['list'] as Record<string, string>;
    expect(entry.fetch).toBe('100,200');
  });

  it('stores object data directly', () => {
    perf.update('metrics', { fps: 60, jank: 2 });
    expect(perf.data.metrics).toEqual({ fps: 60, jank: 2 });
  });

  it('overwrites when storing object data', () => {
    perf.update('metrics', { fps: 60 });
    perf.update('metrics', { fps: 120 });
    expect(perf.data.metrics).toEqual({ fps: 120 });
  });

  it('stores different types independently', () => {
    perf.update('item', 'fetch', 50);
    perf.update('item', 'render', 30);
    const entry = perf.data['item'] as Record<string, string>;
    expect(entry.fetch).toBe('50');
    expect(entry.render).toBe('30');
  });
});
