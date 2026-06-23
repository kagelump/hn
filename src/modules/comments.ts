// Comments page module
import { data } from './data';
import { showPage } from './router';
import { PubSub } from '../utils/pubsub';
import { escapeHtml } from '../utils/template';
import { filterBlockedComments, showModerationSheet, BLOCKED_PLACEHOLDER } from './moderation';
import type { HNComment, HNItem } from '../types';

// Instant feedback after blocking: rewrite the blocked author's visible comments
// as the "[blocked]" placeholder, keeping their replies in place.
function blockUserInPage(page: HTMLElement, user: string): void {
  if (!user) return;
  page.querySelectorAll(`.comment[data-user="${CSS.escape(user)}"]`).forEach(li => {
    const content = li.querySelector(':scope > .comment-body > .comment-content') as HTMLElement | null;
    if (content) {
      content.innerHTML = BLOCKED_PLACEHOLDER;
      content.removeAttribute('style');
    }
  });
}

export function shortenTimeAgo(timeAgo: string): string {
  const match = timeAgo.match(/(\d+)\s+(second|minute|hour|day|month|year)s?\s+ago/);
  if (!match) return timeAgo;
  const unit = match[2][0]; // s, m, h, d, m, y
  return `${match[1]}${unit}`;
}

export function countChildren(comments: HNComment[]): number {
  let count = comments.length;
  for (const comment of comments) {
    if (comment.comments) count += countChildren(comment.comments);
  }
  return count;
}

export function getCommentsHtml(comments: HNComment[], lastReadComment?: number): string {
  return comments.map(comment => {
    const visitedClass = lastReadComment && comment.id < lastReadComment ? 'comment-visited' : '';
    const hasChildren = comment.comments && comment.comments.length > 0;
    const childCount = hasChildren ? countChildren(comment.comments!) : 0;

    const childCountLabel = hasChildren
      ? ` <span class="child-count">${childCount}</span>`
      : '';
    const collapseButton = `<button class="comment-toggle" data-comment-id="${comment.id}" data-total-count="${childCount}" aria-label="Collapse">[-]${childCountLabel}</button>`;

    // Apply HN's downvote color (c88 → #888888, etc.)
    const colorStyle = comment.colorClass
      ? ` style="color: #${comment.colorClass.slice(1)}"`
      : '';

    const childHtml = hasChildren
      ? `<ul class="comment-children" data-parent-id="${comment.id}">${getCommentsHtml(comment.comments!, lastReadComment)}</ul>`
      : '';

    return `
      <li class="comment ${visitedClass}" data-id="${comment.id}" data-user="${escapeHtml(comment.user)}">
        <div class="comment-meta">
          <span class="comment-user" role="button" tabindex="0">${escapeHtml(comment.user)}</span>
          <span class="comment-time">${shortenTimeAgo(comment.time_ago)}</span>
          ${collapseButton}
        </div>
        <div class="comment-body">
          <div class="comment-content"${colorStyle}>${comment.content}</div>
          ${childHtml}
        </div>
      </li>
    `;
  }).join('');
}

export function buildCommentsShareText(title: string, comments: string[], articleId: string | undefined): string {
  const body = comments.join('\n\n');
  const hnLink = articleId ? `https://news.ycombinator.com/item?id=${articleId}` : '';
  return `Summarize the following discussion:\n\n${title}\n${hnLink}\n\n${body}`;
}

function getHeaderHtml(sortWarning?: string): string {
  const warningBtn = sortWarning
    ? `<li><button class="sort-warning-btn" type="button" aria-label="Comment ordering warning" title="Comment ordering issue">!</button></li>`
    : '';

  return `
    <div class="header-container">
      <header class="header">
        <ul class="l-menu list-inline menu">
          <li><a href="#/" class="back-home"><span class="icon icon-arrow-left"></span></a></li>
        </ul>
        <h1>Comments</h1>
        <ul class="r-menu list-inline menu">
          <li><button class="share-btn" type="button" aria-label="Summarize with AI"><!-- Lucide "bot-message-square" icon, ISC License --><svg class="header-svg-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6V2H8"/><path d="M15 11v2"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M9 11v2"/></svg></button></li>
          ${warningBtn}
        </ul>
      </header>
    </div>
  `;
}

function getArticleMetaHtml(article: HNItem): string {
  const opHtml = article.text
    ? `<div class="op-comment"><div class="comment-content">${article.text}</div></div>`
    : '';

  return `
    <div class="article-header">
      <h2>${escapeHtml(article.title)}</h2>
      <div class="article-meta">
        <span class="points">${article.points}</span>
        <span class="author article-author" role="button" tabindex="0" data-user="${escapeHtml(article.user)}">${escapeHtml(article.user)}</span>
        <span class="time-ago">${shortenTimeAgo(article.time_ago)}</span>
        <span class="comments-count">${article.comments_count} comments</span>
      </div>
    </div>
    ${opHtml}
  `;
}

function renderCommentsIntoPage(article: HNItem): void {
  const page = document.querySelector('.page-article-comments') as HTMLElement | null;
  if (!page) return;

  page.dataset.articleId = String(article.id);

  const allComments = filterBlockedComments(article.comments || []);
  const commentsHtml = allComments.length
    ? `<ul class="comments-list">${getCommentsHtml(allComments, article.lastReadComment)}</ul>`
    : '<p class="no-comments">No comments yet.</p>';

  const metaHtml = getArticleMetaHtml(article);

  const warningModal = article.sortWarning
    ? `<div class="sort-warning-modal" style="display:none;">
        <div class="sort-warning-modal-content">
          <p>${escapeHtml(article.sortWarning)}</p>
          <button class="sort-warning-close" type="button">OK</button>
        </div>
       </div>`
    : '';

  page.innerHTML = `
    ${getHeaderHtml(article.sortWarning)}
    <section class="pagebd-container">
      <div class="bd">
        ${metaHtml}
        ${commentsHtml}
      </div>
    </section>
    ${warningModal}
  `;

  // Add next-thread navigation button
  const existingBtn = page.querySelector('.next-thread-btn');
  if (!existingBtn) {
    const btn = document.createElement('button');
    btn.className = 'next-thread-btn';
    btn.innerHTML = '\u25BE';
    btn.setAttribute('aria-label', 'Next top-level comment');
    page.appendChild(btn);
    btn.addEventListener('click', () => {
      const scrollContainer = page.querySelector('.pagebd-container');
      if (!scrollContainer) return;
      const topComments = page.querySelectorAll('.comments-list > .comment');
      const scrollTop = scrollContainer.scrollTop;
      for (const comment of topComments) {
        const el = comment as HTMLElement;
        if (el.offsetTop > scrollTop + 60) {
          scrollContainer.scrollTo({ top: el.offsetTop - 10, behavior: 'smooth' });
          break;
        }
      }
    });
  }
}

export function initCommentsPage(): void {
  const page = document.querySelector('.page-article-comments') as HTMLElement;
  if (page) {
    page.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Tap on the story author (OP) → moderation sheet
      if (target.closest('.article-author')) {
        event.preventDefault();
        const authorEl = target.closest('.article-author') as HTMLElement;
        const user = authorEl.dataset.user || '';
        showModerationSheet({ user, onChange: () => blockUserInPage(page, user) });
        return;
      }

      // Tap on a comment author name → moderation sheet
      if (target.closest('.comment-user')) {
        event.preventDefault();
        const commentLi = target.closest('.comment') as HTMLElement | null;
        if (commentLi) {
          const user = commentLi.dataset.user || '';
          showModerationSheet({ user, onChange: () => blockUserInPage(page, user) });
        }
        return;
      }

      // Handle tap on meta row to collapse (excluding the toggle button itself)
      const metaRow = target.closest('.comment-meta') as HTMLElement | null;
      if (metaRow && !target.closest('.comment-toggle')) {
        const toggleBtn = metaRow.querySelector('.comment-toggle') as HTMLElement | null;
        if (toggleBtn) toggleBtn.click();
        return;
      }

      // Handle AI summarize button
      if (target.closest('.share-btn')) {
        event.preventDefault();
        const titleEl = page.querySelector('.article-header h2');
        const title = titleEl?.textContent?.trim() || '';
        const commentEls = page.querySelectorAll('.comments-list .comment-content');
        const comments = Array.from(commentEls).map(el => (el.textContent || '').trim()).filter(Boolean);
        const articleId = page.dataset.articleId;
        const text = buildCommentsShareText(title, comments, articleId);
        if (navigator.share) {
          navigator.share({ title, text }).catch(() => {});
        } else {
          navigator.clipboard.writeText(text).then(() => {
            alert('Discussion copied to clipboard.');
          }).catch(() => {});
        }
        return;
      }

      // Handle sort warning button
      if (target.closest('.sort-warning-btn')) {
        event.preventDefault();
        const modal = page.querySelector('.sort-warning-modal') as HTMLElement | null;
        if (modal) {
          modal.style.display = 'flex';
        }
        return;
      }

      // Handle sort warning modal close
      if (target.closest('.sort-warning-close')) {
        event.preventDefault();
        const modal = target.closest('.sort-warning-modal') as HTMLElement | null;
        if (modal) {
          modal.style.display = 'none';
        }
        return;
      }

      // Handle collapse toggle button
      const toggleBtn = target.closest('.comment-toggle') as HTMLElement | null;
      if (toggleBtn) {
        event.preventDefault();
        const commentId = toggleBtn.getAttribute('data-comment-id');
        const comment = toggleBtn.closest('.comment') as HTMLElement | null;
        const childList = comment?.querySelector(`.comment-children[data-parent-id="${commentId}"]`) as HTMLElement | null;
        const body = toggleBtn.closest('.comment-meta')?.nextElementSibling as HTMLElement | null;

        if (comment && body) {
          const isCollapsed = comment.classList.toggle('comment-collapsed');
          if (childList) {
            childList.style.display = isCollapsed ? 'none' : '';
          }
          const content = body.querySelector('.comment-content') as HTMLElement | null;
          if (content) {
            content.style.display = isCollapsed ? 'none' : '';
          }
          const totalCount = Number(toggleBtn.getAttribute('data-total-count')) || 0;
          const countLabel = totalCount > 0
            ? ` <span class="child-count">${totalCount}</span>`
            : '';
          toggleBtn.innerHTML = isCollapsed ? `[+]${countLabel}` : `[-]${countLabel}`;
        }
        return;
      }
    });
  }

  PubSub.subscribe('show-comments', (id: unknown) => {
    const articleId = Number(id);
    showPage('page-article-comments', 'Comments');

    const cached = data.getArticleById(articleId);
    if (cached) {
      // Phase 1: render header + article meta instantly from cache
      const page = document.querySelector('.page-article-comments') as HTMLElement | null;
      if (page) {
        page.innerHTML = `
          ${getHeaderHtml(cached.sortWarning)}
          <section class="pagebd-container">
            <div class="bd">
              ${getArticleMetaHtml(cached)}
              <div class="show-loading"><div class="circle"></div></div>
            </div>
          </section>
        `;
      }
      // Phase 2: fetch full comment tree and fill in
      data.getArticleComments(articleId, (article) => {
        renderCommentsIntoPage(article);
      });
    } else {
      // Cold load: render everything after fetch
      data.getArticleComments(articleId, (article) => {
        renderCommentsIntoPage(article);
      });
    }
  });

  PubSub.subscribe('onPageHidden', (className: unknown) => {
    if (typeof className === 'string' && className.includes('page-article-comments')) {
      const page = document.querySelector('.page-article-comments');
      if (page) {
        setTimeout(() => { page.innerHTML = ''; }, 450);
      }
    }
  });
}
