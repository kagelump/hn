// Moderation module — user blocking and content reporting.
//
// These features satisfy App Store Review Guideline 1.2 (user-generated
// content): the app surfaces public Hacker News comments and stories, so it
// must let users hide content from abusive accounts and flag objectionable
// content. Blocking is entirely client-side (no account, no backend); reports
// are routed to the maintainer's email.
import { store } from '../utils/storage';
import type { HNComment, HNItem } from '../types';

const BLOCKED_USERS_KEY = 'blockedUsers';
export const REPORT_EMAIL = 'raycatdev@hinoka.org';
const HN_ITEM_URL = 'https://news.ycombinator.com/item';

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

// Recursively drop comments authored by blocked users, including their replies.
export function filterBlockedComments(comments: HNComment[]): HNComment[] {
  const blocked = new Set(getBlockedUsers());
  if (blocked.size === 0) return comments;

  function walk(items: HNComment[]): HNComment[] {
    return items
      .filter(c => !blocked.has(normalize(c.user)))
      .map(c => ({
        ...c,
        comments: c.comments ? walk(c.comments) : c.comments
      }));
  }

  return walk(comments);
}

// Drop stories authored by blocked users.
export function filterBlockedStories(items: HNItem[]): HNItem[] {
  const blocked = new Set(getBlockedUsers());
  if (blocked.size === 0) return items;
  return items.filter(item => !blocked.has(normalize(item.user)));
}

// Open the user's mail client with a pre-filled report. mailto works in
// WKWebView (iOS) and the browser; the maintainer acts on reports per the
// published content policy.
export function reportContent(opts: {
  kind: 'comment' | 'story';
  id: number;
  user: string;
}): void {
  const { kind, id, user } = opts;
  const link = `${HN_ITEM_URL}?id=${id}`;
  const subject = `[HN Reader] Report ${kind} ${id}`;
  const body =
    `I am reporting the following ${kind} as objectionable:\n\n` +
    `Author: ${user || 'unknown'}\n` +
    `Link: ${link}\n\n` +
    `Reason (please describe):\n`;
  const url = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}

// Lightweight action sheet shown when a user taps an author name. Built with
// plain DOM so it works inside the framework-free app.
export function showModerationSheet(opts: {
  kind: 'comment' | 'story';
  id: number;
  user: string;
  onChange?: () => void;
}): void {
  const { kind, id, user, onChange } = opts;
  if (!user) return;

  // Remove any existing sheet first
  document.querySelector('.moderation-sheet-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'moderation-sheet-overlay';
  overlay.innerHTML = `
    <div class="moderation-sheet" role="dialog" aria-label="Moderation options">
      <div class="moderation-sheet-title">${escapeName(user)}</div>
      <button class="moderation-sheet-btn" data-action="block">Block this user</button>
      <button class="moderation-sheet-btn" data-action="report">Report ${kind}</button>
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
    } else if (action === 'report') {
      close();
      reportContent({ kind, id, user });
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
