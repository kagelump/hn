// Comments page module
import { data } from './data';
import { showPage } from './router';
import { PubSub } from '../utils/pubsub';
import { escapeHtml } from '../utils/template';
import type { HNComment, HNItem } from '../types';

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
      ? ` <span class="child-count">${childCount} ${childCount === 1 ? 'reply' : 'replies'}</span>`
      : '';
    const collapseButton = `<button class="comment-toggle" data-comment-id="${comment.id}" data-total-count="${childCount}" aria-label="Collapse">[-]${childCountLabel}</button>`;

    const childHtml = hasChildren
      ? `<ul class="comment-children" data-parent-id="${comment.id}">${getCommentsHtml(comment.comments!, lastReadComment)}</ul>`
      : '';

    return `
      <li class="comment ${visitedClass}" data-id="${comment.id}">
        <div class="comment-meta">
          ${collapseButton}
          <span class="comment-user">${escapeHtml(comment.user)}</span>
          <span class="comment-time">${comment.time_ago}</span>
        </div>
        <div class="comment-body">
          <div class="comment-content">${comment.content}</div>
          ${childHtml}
        </div>
      </li>
    `;
  }).join('');
}

function renderCommentsPage(article: HNItem): void {
  const page = document.querySelector('.page-article-comments') as HTMLElement | null;
  if (!page) return;

  const headerHtml = `
    <div class="header-container">
      <header class="header">
        <ul class="l-menu list-inline menu">
          <li><a href="#/" class="back-home"><span class="icon icon-arrow-left"></span></a></li>
        </ul>
        <h1>Comments</h1>
        <ul class="r-menu list-inline menu"></ul>
      </header>
    </div>
  `;

  const opHtml = article.text
    ? `<div class="op-comment"><div class="comment-content">${article.text}</div></div>`
    : '';

  const allComments = article.comments || [];

  const commentsHtml = allComments.length
    ? `<ul class="comments-list">${getCommentsHtml(allComments, article.lastReadComment)}</ul>`
    : '<p class="no-comments">No comments yet.</p>';

  page.innerHTML = `
    ${headerHtml}
    <section class="pagebd-container">
      <div class="bd">
        <div class="article-header">
          <h2>${escapeHtml(article.title)}</h2>
          <div class="article-meta">
            <span class="points">${article.points}</span>
            <span class="author">${escapeHtml(article.user)}</span>
            <span class="time-ago">${article.time_ago}</span>
            <span class="comments-count">${article.comments_count} comments</span>
          </div>
        </div>
        ${opHtml}
        ${commentsHtml}
      </div>
    </section>
  `;

  // Event delegation for collapse/expand
  page.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as HTMLElement;

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
          ? ` <span class="child-count">${totalCount} ${totalCount === 1 ? 'reply' : 'replies'}</span>`
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

    data.getArticleComments(articleId, (article) => {
      renderCommentsPage(article);
    });
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
