import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Capacitor before importing the module under test
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
  CapacitorHttp: { get: vi.fn() }
}));

import {
  buildArticleShareText,
  getCorsProxyUrl,
  parseWithReadability
} from '../article';
import { store } from '../../utils/storage';

describe('buildArticleShareText', () => {
  it('includes the url line when a url is present', () => {
    const text = buildArticleShareText(
      'Title',
      'https://example.com',
      'https://news.ycombinator.com/item?id=1',
      'body text'
    );
    expect(text).toBe(
      'Summarize the following article:\n\nTitle\nhttps://example.com\nhttps://news.ycombinator.com/item?id=1\n\nbody text'
    );
  });

  it('omits the url line when url is empty', () => {
    const text = buildArticleShareText(
      'Title',
      '',
      'https://news.ycombinator.com/item?id=1',
      'body text'
    );
    expect(text).toBe(
      'Summarize the following article:\n\nTitle\nhttps://news.ycombinator.com/item?id=1\n\nbody text'
    );
  });
});

describe('getCorsProxyUrl', () => {
  beforeEach(() => {
    store.remove('corsProxy');
  });

  it('returns the stored proxy when one is set', () => {
    store.set('corsProxy', 'https://my-proxy.test/?url=');
    expect(getCorsProxyUrl()).toBe('https://my-proxy.test/?url=');
  });

  it('falls back to the default proxy when none is stored', () => {
    expect(getCorsProxyUrl()).toBe('https://api.allorigins.win/raw?url=');
  });
});

describe('parseWithReadability', () => {
  it('extracts title, byline and content from parseable HTML', () => {
    const html = `
      <html>
        <head><title>An Interesting Article</title></head>
        <body>
          <article>
            <h1>An Interesting Article</h1>
            <p class="byline">By Jane Doe</p>
            <p>This is the first substantial paragraph of the article body, with enough
               text that Readability treats it as real content worth extracting.</p>
            <p>Here is a second paragraph that continues the discussion at length so the
               readability heuristics keep this block as the main article content.</p>
            <p>A third paragraph adds yet more body text to make extraction reliable.</p>
          </article>
        </body>
      </html>`;
    const parsed = parseWithReadability(html, 'https://example.com/post');
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toContain('Interesting Article');
    expect(parsed!.content).toContain('first substantial paragraph');
  });

  it('returns null when there is no extractable content', () => {
    const parsed = parseWithReadability('<html></html>', 'https://example.com/empty');
    expect(parsed).toBeNull();
  });
});


