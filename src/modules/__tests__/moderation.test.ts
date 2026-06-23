import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBlockedUsers,
  isBlocked,
  blockUser,
  unblockUser,
  filterBlockedComments,
  filterBlockedStories,
  showModerationSheet
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

  it('removes a blocked author and their replies', () => {
    blockUser('troll');
    const comments = [
      comment(1, 'alice', [comment(2, 'troll'), comment(3, 'bob')]),
      comment(4, 'troll', [comment(5, 'alice')])
    ];
    const filtered = filterBlockedComments(comments);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
    expect(filtered[0].comments).toHaveLength(1);
    expect(filtered[0].comments![0].id).toBe(3);
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

  it('renders block and report actions', () => {
    showModerationSheet({ kind: 'comment', id: 42, user: 'alice' });
    const sheet = document.querySelector('.moderation-sheet-overlay');
    expect(sheet).not.toBeNull();
    expect(document.querySelector('[data-action="block"]')).not.toBeNull();
    expect(document.querySelector('[data-action="report"]')).not.toBeNull();
  });

  it('blocks the user and fires onChange when block is tapped', () => {
    let changed = false;
    showModerationSheet({ kind: 'comment', id: 42, user: 'alice', onChange: () => { changed = true; } });
    (document.querySelector('[data-action="block"]') as HTMLElement).click();
    expect(isBlocked('alice')).toBe(true);
    expect(changed).toBe(true);
    expect(document.querySelector('.moderation-sheet-overlay')).toBeNull();
  });

  it('closes without blocking on cancel', () => {
    showModerationSheet({ kind: 'story', id: 7, user: 'bob' });
    (document.querySelector('[data-action="cancel"]') as HTMLElement).click();
    expect(isBlocked('bob')).toBe(false);
    expect(document.querySelector('.moderation-sheet-overlay')).toBeNull();
  });

  it('does nothing for an empty user', () => {
    showModerationSheet({ kind: 'comment', id: 1, user: '' });
    expect(document.querySelector('.moderation-sheet-overlay')).toBeNull();
  });
});
