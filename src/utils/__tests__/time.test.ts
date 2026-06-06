import { describe, it, expect } from 'vitest';
import { timeAgo } from '../time';

describe('timeAgo', () => {
  const now = Date.now();

  it('returns "Just now!" for times within 60 seconds', () => {
    expect(timeAgo(now - 30_000, now)).toBe('Just now!');
    expect(timeAgo(now - 1_000, now)).toBe('Just now!');
    expect(timeAgo(now, now)).toBe('Just now!');
  });

  it('returns minutes ago', () => {
    expect(timeAgo(now - 120_000, now)).toBe('2 minutes ago');
    expect(timeAgo(now - 61_000, now)).toBe('1 minute ago');
    expect(timeAgo(now - 300_000, now)).toBe('5 minutes ago');
  });

  it('returns hours ago', () => {
    expect(timeAgo(now - 3_600_000, now)).toBe('1 hour ago');
    expect(timeAgo(now - 7_200_000, now)).toBe('2 hours ago');
    expect(timeAgo(now - 36_000_000, now)).toBe('10 hours ago');
  });

  it('returns formatted date for older times', () => {
    const jan2020 = new Date(2020, 0, 15).getTime();
    expect(timeAgo(jan2020, now)).toBe('Jan 15 2020');
  });

  it('returns empty string for non-number types', () => {
    expect(timeAgo('not a number' as unknown as number, now)).toBe('');
  });

  it('returns "Just now!" at exactly 60 seconds (boundary)', () => {
    // offset <= MINUTE (60) → "Just now!"
    expect(timeAgo(now - 60_000, now)).toBe('Just now!');
  });

  it('handles negative offsets (future times)', () => {
    // Math.abs means future times are treated the same
    expect(timeAgo(now + 30_000, now)).toBe('Just now!');
  });
});
