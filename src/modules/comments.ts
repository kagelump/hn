// Comments page module
import { data } from './data';
import { showPage } from './router';
import { PubSub } from '../utils/pubsub';
import { escapeHtml } from '../utils/template';
import type { HNComment, HNItem } from '../types';

function shortenTimeAgo(timeAgo: string): string {
  const match = timeAgo.match(/(\d+)\s+(second|minute|hour|day|month|year)s?\s+ago/);
  if (!match) return timeAgo;
  const unit = match[2][0]; // s, m, h, d, m, y
  return `${match[1]}${unit}`;
}

function countChildren(comments: HNComment[]): number {
  let count = comments.length;
  for (const comment of comments) {
    if (comment.comments) count += countChildren(comment.comments);
  }
  return count;
}

function getCommentsHtml(comments: HNComment[], lastReadComment?: number): string {
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
      <li class="comment ${visitedClass}" data-id="${comment.id}">
        <div class="comment-meta">
          <span class="comment-user">${escapeHtml(comment.user)}</span>
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
        <ul class="r-menu list-inline menu">${warningBtn}</ul>
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
        <span class="author">${escapeHtml(article.user)}</span>
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

  const allComments = article.comments || [];
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

  // Event delegation for collapse/expand and warning modal
  page.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as HTMLElement;

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
        // Also hide the comment body content when collapsed
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

export function initCommentsPage(): void {
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
        setTimeout(() => { page.innerHTML = ''; }, 300);
      }
    }
  });
}
