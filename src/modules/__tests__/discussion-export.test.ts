import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HNItem } from '../../types';
import { buildCommentsShareText, extractDiscussionArticle, shareDiscussion } from '../discussion-export';
import { fetchArticleHtml, parseWithReadability } from '../article';
import { shareTextFile } from '../../utils/share';
import { blockUser } from '../moderation';

vi.mock('../article', () => ({ fetchArticleHtml: vi.fn(), parseWithReadability: vi.fn() }));
vi.mock('../../utils/share', () => ({ shareTextFile: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

const story = (overrides: Partial<HNItem> = {}): HNItem => ({
  id: 42, title: 'A &amp; B', points: 1, user: 'op', time_ago: '', self: false,
  comments_count: 3, url: 'https://example.com/article',
  comments: [{ id: 101, user: 'alice', time_ago: '', content: '<p>Parent</p>', comments: [
    { id: 102, user: 'bob', time_ago: '', content: '<p>Reply</p>' }
  ] }, { id: 103, user: 'carol', time_ago: '', content: 'Another thread' }],
  ...overrides
});

afterEach(() => {
  document.querySelector<HTMLButtonElement>('.export-cancel')?.click();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('discussion export', () => {
  it('includes both source links, article text, post text and explicit reply structure', () => {
    const text = buildCommentsShareText(story({ text: '<p>Introduction</p>' }), 'Extracted article');
    expect(text).toContain('# Discussion: A & B');
    expect(text).toContain('HN: https://news.ycombinator.com/item?id=42');
    expect(text).toContain('Article: https://example.com/article');
    expect(text).toContain('## Original post\nIntroduction');
    expect(text).toContain('## Article text\nExtracted article');
    expect(text).toContain('### [1.1] bob\nID: 102 | Reply to: [1] alice\n\nReply');
    expect(text).toContain('### [2] carol\nID: 103 | Reply to: original post');
  });

  it('preserves replies to blocked comments without exporting blocked text', () => {
    blockUser('alice');
    const text = buildCommentsShareText(story());
    expect(text).not.toContain('Parent');
    expect(text).toContain('\n\n[blocked]');
    expect(text).toContain('Reply to: [1] alice');
    expect(text).toContain('\n\nReply');
  });

  it('reports extraction failure and partial-source warnings', () => {
    const text = buildCommentsShareText(story({ sortWarning: 'Showing top comments only.' }));
    expect(text).toContain('[Article text unavailable.');
    expect(text).toContain('Source note: Showing top comments only.');
  });

  it('shares HN text posts immediately, including the post body', () => {
    shareDiscussion(story({ url: undefined, self: true, text: '<p>Tell HN: hello</p>' }));
    expect(fetchArticleHtml).not.toHaveBeenCalled();
    expect(shareTextFile).toHaveBeenCalledWith('A & B', expect.stringContaining('## Original post\nTell HN: hello'), 'discussion');
  });

  it('fetches and extracts external articles, preserving relative links', async () => {
    vi.mocked(fetchArticleHtml).mockResolvedValue('<html>source</html>');
    vi.mocked(parseWithReadability).mockReturnValue({ title: 'Article', byline: '', content: '<p>Read <a href="/source">source</a>.</p>' });
    expect(await extractDiscussionArticle(story())).toBe('Read [source](https://example.com/source).');
    expect(parseWithReadability).toHaveBeenCalledWith('<html>source</html>', 'https://example.com/article');
  });

  it('can still export when article fetching fails', async () => {
    vi.mocked(fetchArticleHtml).mockRejectedValue(new Error('Offline'));
    expect(await extractDiscussionArticle(story())).toBeUndefined();
  });

  it('waits for a fresh tap to share after fetching', async () => {
    vi.mocked(fetchArticleHtml).mockResolvedValue('html');
    vi.mocked(parseWithReadability).mockReturnValue({ title: '', byline: '', content: '<p>Extracted body</p>' });
    shareDiscussion(story());
    expect(document.querySelector<HTMLButtonElement>('.export-share')!.disabled).toBe(true);
    expect(shareTextFile).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(document.querySelector<HTMLButtonElement>('.export-share')!.disabled).toBe(false));
    document.querySelector<HTMLButtonElement>('.export-share')!.click();
    expect(shareTextFile).toHaveBeenCalledWith('A & B', expect.stringContaining('Extracted body'), 'discussion');
    expect(document.querySelector('.discussion-export-overlay')).toBeNull();
  });

  it('does not reopen a cancelled preparation', async () => {
    vi.mocked(fetchArticleHtml).mockReturnValue(new Promise(() => {}));
    shareDiscussion(story());
    document.querySelector<HTMLButtonElement>('.export-cancel')!.click();
    await Promise.resolve();
    expect(document.querySelector('.discussion-export-overlay')).toBeNull();
    expect(shareTextFile).not.toHaveBeenCalled();
  });

  it('offers a usable attachment when fetching times out', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchArticleHtml).mockReturnValue(new Promise(() => {}));
    shareDiscussion(story());
    await vi.advanceTimersByTimeAsync(20_000);
    expect(document.querySelector<HTMLButtonElement>('.export-share')!.disabled).toBe(false);
    document.querySelector<HTMLButtonElement>('.export-share')!.click();
    expect(shareTextFile).toHaveBeenCalledWith('A & B', expect.stringContaining('[Article text unavailable.'), 'discussion');
  });
});
