import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBlockedUsers,
  isBlocked,
  blockUser,
  unblockUser,
  filterBlockedComments,
  filterBlockedStories,
  showModerationSheet,
  BLOCKED_PLACEHOLDER
} from '../moderation';
import type { HNComment, HNItem } from '../../types';

function comment(id: number, user: string, children: HNComment[] = []): HNComment {
  return { id, user, time_ago: '1h', content: 'hi', comments: children };
}

function story(id: number, user: string): HNItem {
  return { id, title: 't', points: 1, user, time_ago: '1h', self: true, comments_count: 0 };
}

describe('moderation: block list', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts empty', () => {
    expect(getBlockedUsers()).toEqual([]);
    expect(isBlocked('alice')).toBe(false);
  });

  it('blocks and unblocks a user', () => {
    blockUser('alice');
    expect(getBlockedUsers()).toEqual(['alice']);
    expect(isBlocked('alice')).toBe(true);

    unblockUser('alice');
    expect(getBlockedUsers()).toEqual([]);
    expect(isBlocked('alice')).toBe(false);
  });

  it('does not add duplicates or blank names', () => {
    blockUser('alice');
    blockUser('alice');
    blockUser('   ');
    expect(getBlockedUsers()).toEqual(['alice']);
  });

  it('trims whitespace when blocking', () => {
    blockUser('  bob  ');
    expect(isBlocked('bob')).toBe(true);
  });
});

describe('moderation: filtering', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns comments unchanged when nothing is blocked', () => {
    const comments = [comment(1, 'alice'), comment(2, 'bob')];
    expect(filterBlockedComments(comments)).toBe(comments);
  });

  it('rewrites a blocked author as a placeholder but keeps their replies', () => {
    blockUser('troll');
    const comments = [
      comment(1, 'alice', [comment(2, 'troll'), comment(3, 'bob')]),
      comment(4, 'troll', [comment(5, 'alice')])
    ];
    const filtered = filterBlockedComments(comments);

    // Nothing is removed — structure is preserved
    expect(filtered).toHaveLength(2);
    expect(filtered.map(c => c.id)).toEqual([1, 4]);

    // The troll's content is replaced; non-blocked content is untouched
    expect(filtered[0].comments![0].id).toBe(2);
    expect(filtered[0].comments![0].content).toBe(BLOCKED_PLACEHOLDER);
    expect(filtered[0].comments![1].content).toBe('hi');

    // A blocked top-level comment keeps its (non-blocked) replies visible
    expect(filtered[1].content).toBe(BLOCKED_PLACEHOLDER);
    expect(filtered[1].comments![0].id).toBe(5);
    expect(filtered[1].comments![0].content).toBe('hi');
  });

  it('filters blocked authors from story lists', () => {
    blockUser('spammer');
    const stories = [story(1, 'alice'), story(2, 'spammer'), story(3, 'bob')];
    const filtered = filterBlockedStories(stories);
    expect(filtered.map(s => s.id)).toEqual([1, 3]);
  });
});

describe('moderation: action sheet', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  it('renders a block action and no report action', () => {
    showModerationSheet({ user: 'alice' });
    expect(document.querySelector('.moderation-sheet-overlay')).not.toBeNull();
    expect(document.querySelector('[data-action="block"]')).not.toBeNull();
    expect(document.querySelector('[data-action="report"]')).toBeNull();
  });

  it('blocks the user and fires onChange when block is tapped', () => {
    let changed = false;
    showModerationSheet({ user: 'alice', onChange: () => { changed = true; } });
    (document.querySelector('[data-action="block"]') as HTMLElement).click();
    expect(isBlocked('alice')).toBe(true);
    expect(changed).toBe(true);
    expect(document.querySelector('.moderation-sheet-overlay')).toBeNull();
  });

  it('closes without blocking on cancel', () => {
    showModerationSheet({ user: 'bob' });
    (document.querySelector('[data-action="cancel"]') as HTMLElement).click();
    expect(isBlocked('bob')).toBe(false);
    expect(document.querySelector('.moderation-sheet-overlay')).toBeNull();
  });

  it('does nothing for an empty user', () => {
    showModerationSheet({ user: '' });
    expect(document.querySelector('.moderation-sheet-overlay')).toBeNull();
  });
});
