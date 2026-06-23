import { describe, it, expect } from 'vitest';
import {
  shortenTimeAgo,
  countChildren,
  getCommentsHtml,
  buildCommentsShareText
} from '../comments';
import type { HNComment } from '../../types';

function comment(overrides: Partial<HNComment> = {}): HNComment {
  return {
    id: 1,
    user: 'alice',
    time_ago: '1 hour ago',
    content: 'hello',
    ...overrides
  };
}

describe('shortenTimeAgo', () => {
  it('shortens minutes', () => {
    expect(shortenTimeAgo('5 minutes ago')).toBe('5m');
  });

  it('shortens a single hour', () => {
    expect(shortenTimeAgo('1 hour ago')).toBe('1h');
  });

  it('shortens days', () => {
    expect(shortenTimeAgo('3 days ago')).toBe('3d');
  });

  it('shortens years', () => {
    expect(shortenTimeAgo('2 years ago')).toBe('2y');
  });

  it('shortens a singular second', () => {
    expect(shortenTimeAgo('1 second ago')).toBe('1s');
  });

  it('returns the input unchanged when it does not match', () => {
    expect(shortenTimeAgo('just now')).toBe('just now');
  });
});

describe('countChildren', () => {
  it('returns 0 for an empty list', () => {
    expect(countChildren([])).toBe(0);
  });

  it('counts a flat list', () => {
    expect(countChildren([comment({ id: 1 }), comment({ id: 2 }), comment({ id: 3 })])).toBe(3);
  });

  it('counts all descendants recursively', () => {
    const tree: HNComment[] = [
      comment({
        id: 1,
        comments: [
          comment({ id: 2, comments: [comment({ id: 4 }), comment({ id: 5 })] }),
          comment({ id: 3 })
        ]
      })
    ];
    // 1 (root) + 2 (its children) + 2 (grandchildren) = 5
    expect(countChildren(tree)).toBe(5);
  });
});

describe('getCommentsHtml', () => {
  it('marks a comment visited when its id is below lastReadComment', () => {
    const html = getCommentsHtml([comment({ id: 10 })], 20);
    expect(html).toContain('comment-visited');
  });

  it('does not mark visited when id is at or above lastReadComment', () => {
    const html = getCommentsHtml([comment({ id: 30 })], 20);
    expect(html).not.toContain('comment-visited');
  });

  it('does not mark visited when lastReadComment is undefined', () => {
    const html = getCommentsHtml([comment({ id: 10 })]);
    expect(html).not.toContain('comment-visited');
  });

  it('renders the downvote color style from colorClass', () => {
    const html = getCommentsHtml([comment({ id: 1, colorClass: 'c88' })]);
    expect(html).toContain('style="color: #88"');
  });

  it('renders no color style when colorClass is absent', () => {
    const html = getCommentsHtml([comment({ id: 1 })]);
    expect(html).not.toContain('style="color:');
  });

  it('renders a child-count span and data-total-count when there are children', () => {
    const html = getCommentsHtml([
      comment({ id: 1, comments: [comment({ id: 2 }), comment({ id: 3 })] })
    ]);
    expect(html).toContain('child-count');
    expect(html).toContain('data-total-count="2"');
  });

  it('escapes the user field', () => {
    const html = getCommentsHtml([comment({ id: 1, user: '<script>x</script>' })]);
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('buildCommentsShareText', () => {
  it('includes the HN item link when an articleId is given', () => {
    const text = buildCommentsShareText('My Title', ['first', 'second'], '12345');
    expect(text).toBe(
      'Summarize the following discussion:\n\nMy Title\nhttps://news.ycombinator.com/item?id=12345\n\nfirst\n\nsecond'
    );
  });

  it('leaves the link line empty when articleId is undefined', () => {
    const text = buildCommentsShareText('My Title', ['only'], undefined);
    expect(text).toBe('Summarize the following discussion:\n\nMy Title\n\n\nonly');
  });
});
