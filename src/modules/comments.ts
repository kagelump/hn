// Comments page module
import { data, COMMENT_PAGE_SIZE } from './data';
import { showPage } from './router';
import { PubSub } from '../utils/pubsub';
import { escapeHtml } from '../utils/template';
import type { HNComment, HNItem } from '../types';

let currentArticle: HNItem | null = null;
let renderedTopLevelCount = 0;

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

    const collapseButton = hasChildren
      ? `<button class="comment-toggle" data-comment-id="${comment.id}" aria-label="Collapse thread">[-] <span class="child-count">${childCount} ${childCount === 1 ? 'reply' : 'replies'}</span></button>`
      : '';

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

function getLoadMoreHtml(remaining: number): string {
  return `
    <div class="load-more-container">
      <button class="load-more-comments" type="button">
        Load more comments (${remaining} remaining)
      </button>
    </div>
  `;
}

function renderCommentsPage(article: HNItem): void {
  const page = document.querySelector('.page-article-comments') as HTMLElement | null;
  if (!page) return;

  currentArticle = article;
  renderedTopLevelCount = 0;

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

  const topLevelComments = article.comments || [];
  const pageComments = topLevelComments.slice(0, COMMENT_PAGE_SIZE);
  renderedTopLevelCount = pageComments.length;

  const commentsHtml = pageComments.length
    ? `<ul class="comments-list">${getCommentsHtml(pageComments, article.lastReadComment)}</ul>`
    : '<p class="no-comments">No comments yet.</p>';

  const totalTopLevel = article.allKids?.length ?? article.comments_count;
  const remaining = totalTopLevel - renderedTopLevelCount;
  const loadMoreHtml = !article.allCommentsLoaded && remaining > 0
    ? getLoadMoreHtml(remaining)
    : '';

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
        ${loadMoreHtml}
      </div>
    </section>
  `;

  // Event delegation for collapse/expand, tap-to-visited, and load-more
  page.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // Handle load more comments button
    const loadMoreBtn = target.closest('.load-more-comments') as HTMLElement | null;
    if (loadMoreBtn) {
      event.preventDefault();
      loadMoreBtn.textContent = 'Loading...';
      loadMoreBtn.setAttribute('disabled', 'true');

      data.loadMoreComments(article.id, (updatedArticle) => {
        if (!currentArticle || currentArticle.id !== updatedArticle.id) return;
        currentArticle = updatedArticle;

        // Append new top-level comments to the list
        const commentsList = page.querySelector('.comments-list') as HTMLElement | null;
        if (commentsList) {
          const newTopLevel = (updatedArticle.comments || []).slice(renderedTopLevelCount);
          if (newTopLevel.length) {
            const newHtml = getCommentsHtml(newTopLevel, updatedArticle.lastReadComment);
            commentsList.insertAdjacentHTML('beforeend', newHtml);
          }
        }

        renderedTopLevelCount = updatedArticle.comments?.length ?? 0;

        // Update or remove the load-more button
        const totalTopLevel = updatedArticle.allKids?.length ?? updatedArticle.comments_count;
        const remaining = totalTopLevel - renderedTopLevelCount;
        const container = page.querySelector('.load-more-container') as HTMLElement | null;
        if (container) {
          if (updatedArticle.allCommentsLoaded || remaining <= 0) {
            container.remove();
          } else {
            const btn = container.querySelector('.load-more-comments') as HTMLElement | null;
            if (btn) {
              btn.textContent = `Load more comments (${remaining} remaining)`;
              btn.removeAttribute('disabled');
            }
          }
        }
      });
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
        toggleBtn.innerHTML = isCollapsed
          ? `[+] <span class="child-count">${childList?.children.length ?? 0} ${childList?.children.length === 1 ? 'reply' : 'replies'}</span>`
          : `[-] <span class="child-count">${childList?.children.length ?? 0} ${childList?.children.length === 1 ? 'reply' : 'replies'}</span>`;
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
      currentArticle = null;
      renderedTopLevelCount = 0;
    }
  });
}
