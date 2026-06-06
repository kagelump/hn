import { describe, it, expect, beforeEach } from 'vitest';
import { loading } from '../ui';

describe('LoadingIndicator', () => {
  beforeEach(() => {
    // Create fresh loading element for each test
    document.body.innerHTML = '<div id="loading"></div>';
    // Force re-read of the DOM element
    (loading as unknown as { node: HTMLElement | null }).node = document.getElementById('loading');
  });

  it('is not visible initially', () => {
    expect(loading.isVisible()).toBe(false);
  });

  it('becomes visible after show()', () => {
    loading.show(100, 200);
    expect(loading.isVisible()).toBe(true);
  });

  it('sets position style on show()', () => {
    loading.show(150, 250);
    const node = document.getElementById('loading');
    expect(node?.style.top).toBe('250px');
    expect(node?.style.left).toBe('150px');
  });

  it('hides after show()', () => {
    loading.show(0, 0);
    loading.hide();
    expect(loading.isVisible()).toBe(false);
  });

  it('sets className to show-loading on show()', () => {
    loading.show(0, 0);
    expect(document.getElementById('loading')?.className).toBe('show-loading');
  });

  it('clears className on hide()', () => {
    loading.show(0, 0);
    loading.hide();
    expect(document.getElementById('loading')?.className).toBe('');
  });
});
