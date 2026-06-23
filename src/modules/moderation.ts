// Moderation module — user blocking.
//
// HN Reader is a read-only client for Hacker News, a heavily moderated public
// platform. Beyond that, the app lets users block individual authors: blocked
// authors' stories are hidden and their comments are replaced with a "[blocked]"
// placeholder (replies are preserved). Blocking is entirely client-side — no
// account, no backend.
import { store } from '../utils/storage';
import type { HNComment, HNItem } from '../types';

const BLOCKED_USERS_KEY = 'blockedUsers';
export const BLOCKED_PLACEHOLDER = '<span class="comment-blocked">[blocked]</span>';

function normalize(user: string): string {
  return (user || '').trim();
}

export function getBlockedUsers(): string[] {
  return store.get<string[]>(BLOCKED_USERS_KEY) || [];
}

export function isBlocked(user: string): boolean {
  return getBlockedUsers().includes(normalize(user));
}

export function blockUser(user: string): void {
  const name = normalize(user);
  if (!name) return;
  const blocked = getBlockedUsers();
  if (!blocked.includes(name)) {
    blocked.push(name);
    store.set(BLOCKED_USERS_KEY, blocked);
  }
}

export function unblockUser(user: string): void {
  const name = normalize(user);
  const blocked = getBlockedUsers().filter(u => u !== name);
  store.set(BLOCKED_USERS_KEY, blocked);
}

// Rewrite comments authored by blocked users as a "[blocked]" placeholder,
// recursing into replies (which stay visible to preserve thread structure).
export function filterBlockedComments(comments: HNComment[]): HNComment[] {
  const blocked = new Set(getBlockedUsers());
  if (blocked.size === 0) return comments;

  function walk(items: HNComment[]): HNComment[] {
    return items.map(c => {
      const isHidden = blocked.has(normalize(c.user));
      return {
        ...c,
        content: isHidden ? BLOCKED_PLACEHOLDER : c.content,
        colorClass: isHidden ? undefined : c.colorClass,
        comments: c.comments ? walk(c.comments) : c.comments
      };
    });
  }

  return walk(comments);
}

// Drop stories authored by blocked users.
export function filterBlockedStories(items: HNItem[]): HNItem[] {
  const blocked = new Set(getBlockedUsers());
  if (blocked.size === 0) return items;
  return items.filter(item => !blocked.has(normalize(item.user)));
}

// Lightweight action sheet shown when a user taps an author name. Built with
// plain DOM so it works inside the framework-free app.
export function showModerationSheet(opts: {
  user: string;
  onChange?: () => void;
}): void {
  const { user, onChange } = opts;
  if (!user) return;

  // Remove any existing sheet first
  document.querySelector('.moderation-sheet-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'moderation-sheet-overlay';
  overlay.innerHTML = `
    <div class="moderation-sheet" role="dialog" aria-label="Moderation options">
      <div class="moderation-sheet-title">${escapeName(user)}</div>
      <button class="moderation-sheet-btn" data-action="block">Block this user</button>
      <button class="moderation-sheet-btn moderation-sheet-cancel" data-action="cancel">Cancel</button>
    </div>
  `;

  function close(): void {
    overlay.remove();
  }

  overlay.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target === overlay) {
      close();
      return;
    }
    const action = target.closest('[data-action]')?.getAttribute('data-action');
    if (action === 'block') {
      blockUser(user);
      close();
      onChange?.();
    } else if (action === 'cancel') {
      close();
    }
  });

  document.body.appendChild(overlay);
}

function escapeName(user: string): string {
  const div = document.createElement('div');
  div.textContent = user;
  return div.innerHTML;
}
