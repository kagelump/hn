import { describe, it, expect, beforeEach } from 'vitest';
import { loading } from '../ui';

describe('LoadingIndicator', () => {
  beforeEach(() => {
    // Create fresh loading elements for each test
    document.body.innerHTML = `
      <div id="loading"></div>
      <div id="loading-status"></div>
    `;
    // Force re-read of the DOM elements
    (loading as unknown as { node: HTMLElement | null }).node = document.getElementById('loading');
    (loading as unknown as { statusNode: HTMLElement | null }).statusNode = document.getElementById('loading-status');
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

  describe('setStatus', () => {
    it('updates the status node text and shows it', () => {
      loading.setStatus('Loading stories...');
      const statusNode = document.getElementById('loading-status');
      expect(statusNode?.textContent).toBe('Loading stories...');
      expect((statusNode as HTMLElement).style.display).toBe('block');
    });

    it('hides the status node when text is empty', () => {
      loading.setStatus('Loading stories...');
      loading.setStatus('');
      const statusNode = document.getElementById('loading-status');
      expect(statusNode?.textContent).toBe('');
      expect((statusNode as HTMLElement).style.display).toBe('none');
    });
  });

  describe('clearStatus', () => {
    it('clears the status node text and hides it', () => {
      loading.setStatus('Loading stories...');
      loading.clearStatus();
      const statusNode = document.getElementById('loading-status');
      expect(statusNode?.textContent).toBe('');
      expect((statusNode as HTMLElement).style.display).toBe('none');
    });
  });
});
