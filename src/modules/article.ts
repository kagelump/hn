// Article content page module
import { data } from './data';
import { showPage } from './router';
import { PubSub } from '../utils/pubsub';
import { escapeHtml } from '../utils/template';
import type { HNItem } from '../types';

function renderArticlePage(article: HNItem): void {
  const page = document.querySelector('.page-article-content') as HTMLElement | null;
  if (!page) return;

  const headerHtml = `
    <div class="header-container">
      <header class="header">
        <ul class="l-menu list-inline menu">
          <li><a href="#/" class="back-home"><span class="icon icon-arrow-left"></span></a></li>
        </ul>
        <h1>Article</h1>
        <ul class="r-menu list-inline menu">
          <li><a href="#/comments/${article.id}" class="show-comments"><span class="icon icon-bubble"></span></a></li>
        </ul>
      </header>
    </div>
  `;

  let contentHtml: string;

  if (article.text) {
    // Self post (Ask HN, Show HN, Job) — render the text
    contentHtml = `
      <div class="article-header">
        <h2>${escapeHtml(article.title)}</h2>
        <div class="article-meta">
          <span class="points">${article.points}</span>
          <span class="author">${escapeHtml(article.user)}</span>
          <span class="time-ago">${article.time_ago}</span>
        </div>
      </div>
      <div class="article-content">${article.text}</div>
    `;
  } else if (article.url) {
    // External link — show link and metadata
    const displayUrl = article.url.replace(/^https?:\/\//, '');
    contentHtml = `
      <div class="article-header">
        <h2>${escapeHtml(article.title)}</h2>
        <div class="article-meta">
          <span class="points">${article.points}</span>
          <span class="author">${escapeHtml(article.user)}</span>
          <span class="time-ago">${article.time_ago}</span>
        </div>
      </div>
      <div class="article-link">
        <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayUrl)}</a>
      </div>
    `;
  } else {
    contentHtml = `
      <div class="article-header">
        <h2>${escapeHtml(article.title)}</h2>
      </div>
      <p>No content available.</p>
    `;
  }

  page.innerHTML = `
    ${headerHtml}
    <section class="pagebd-container">
      <div class="bd">${contentHtml}</div>
    </section>
  `;
}

export function initArticlePage(): void {
  PubSub.subscribe('show-article', (id: unknown) => {
    const articleId = Number(id);
    showPage('page-article-content', 'Article');

    data.getArticleMeta(articleId, (article) => {
      renderArticlePage(article);
    });
  });

  PubSub.subscribe('onPageHidden', (className: unknown) => {
    if (typeof className === 'string' && className.includes('page-article-content')) {
      const page = document.querySelector('.page-article-content');
      if (page) {
        setTimeout(() => { page.innerHTML = ''; }, 300);
      }
    }
  });
}
