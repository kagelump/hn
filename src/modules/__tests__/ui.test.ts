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
    loading.show();
    expect(loading.isVisible()).toBe(true);
  });

  it('sets className to show-loading on show()', () => {
    loading.show();
    expect(document.getElementById('loading')?.className).toBe('show-loading');
  });

  it('hides after show()', () => {
    loading.show();
    loading.hide();
    expect(loading.isVisible()).toBe(false);
  });

  it('clears className on hide()', () => {
    loading.show();
    loading.hide();
    expect(document.getElementById('loading')?.className).toBe('');
  });
});
