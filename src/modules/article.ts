// Article content page module
import { Readability } from '@mozilla/readability';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { data } from './data';
import { showPage } from './router';
import { PubSub } from '../utils/pubsub';
import { store } from '../utils/storage';
import { escapeHtml } from '../utils/template';
import type { HNItem } from '../types';

const DEFAULT_CORS_PROXY = 'https://api.allorigins.win/raw?url=';

function getCorsProxyUrl(): string {
  return store.get<string>('corsProxy') || DEFAULT_CORS_PROXY;
}

async function fetchArticleHtml(url: string): Promise<string> {
  console.log('[Reader] Fetching article:', url);
  console.log('[Reader] Platform:', Capacitor.getPlatform(), 'isNative:', Capacitor.isNativePlatform());

  // On native platforms, use CapacitorHttp (no CORS needed)
  if (Capacitor.isNativePlatform()) {
    try {
      console.log('[Reader] Calling CapacitorHttp.get...');
      const result = await CapacitorHttp.get({ url, responseType: 'text' });
      const html = result.data as string;
      console.log('[Reader] Native result: html length:', html?.length ?? 0);
      if (html) {
        return html;
      }
    } catch (err) {
      console.warn('[Reader] Native fetch failed, falling back to CORS proxy:', err);
    }
  }

  // Web fallback: use CORS proxy
  const proxy = getCorsProxyUrl();
  const proxyUrl = proxy + encodeURIComponent(url);
  console.log('[Reader] Using CORS proxy:', proxyUrl);
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status}`);
  }
  return response.text();
}

function parseWithReadability(html: string, url: string): { title: string; byline: string; content: string } | null {
  console.log('[Reader] Parsing with Readability, HTML length:', html.length);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Rewrite relative URLs to absolute
  const base = doc.createElement('base');
  base.href = url;
  doc.head.appendChild(base);

  const reader = new Readability(doc);
  const article = reader.parse();
  if (!article) {
    console.warn('[Reader] Readability returned null for:', url);
    return null;
  }

  console.log('[Reader] Readability parsed successfully:', article.title, 'content length:', article.content?.length);
  return {
    title: article.title || '',
    byline: article.byline || '',
    content: article.content || ''
  };
}

async function loadReaderContent(url: string, container: HTMLElement): Promise<void> {
  try {
    const html = await fetchArticleHtml(url);
    // Bail if the user navigated away while fetching
    if (!container.isConnected) return;

    const parsed = parseWithReadability(html, url);

    if (!parsed) {
      container.innerHTML = '<p class="reader-error">Could not extract article content.</p>';
      return;
    }

    const bylineHtml = parsed.byline
      ? `<div class="reader-byline">${escapeHtml(parsed.byline)}</div>`
      : '';

    container.innerHTML = `
      <div class="reader-content">
        ${bylineHtml}
        <div class="reader-body">${parsed.content}</div>
      </div>
    `;
  } catch (err) {
    console.error('Reader mode failed:', err);
    if (container.isConnected) {
      container.innerHTML = '<p class="reader-error">Failed to load article. Try opening the link directly.</p>';
    }
  }
}

async function shareArticle(): Promise<void> {
  const page = document.querySelector('.page-article-content') as HTMLElement | null;
  if (!page) return;

  const titleEl = page.querySelector('.article-header h2');
  const title = titleEl?.textContent?.trim() || '';

  const linkEl = page.querySelector('.article-link a') as HTMLAnchorElement | null;
  const url = linkEl?.href || '';

  // Gather full article content from reader view or self-post
  const contentEl = page.querySelector('.reader-content') || page.querySelector('.article-content');
  const bodyText = contentEl ? (contentEl.textContent || '').trim() : '';

  const shareText = url
    ? `${title}\n${url}\n\n${bodyText}`
    : `${title}\n\n${bodyText}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text: shareText,
        url: url || undefined
      });
    } catch {
      // User cancelled — no action needed
    }
  } else {
    // Fallback: copy full content to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      alert('Article content copied to clipboard.');
    } catch {
      // last resort
    }
  }
}

function renderArticlePage(article: HNItem): void {
  const page = document.querySelector('.page-article-content') as HTMLElement | null;
  if (!page) return;

  const hasExternalUrl = !!article.url;

  const headerHtml = `
    <div class="header-container">
      <header class="header">
        <ul class="l-menu list-inline menu">
          <li><a href="#/" class="back-home"><span class="icon icon-arrow-left"></span></a></li>
        </ul>
        <h1>Article</h1>
        <ul class="r-menu list-inline menu">
          ${hasExternalUrl ? `<li><button class="reader-toggle active" type="button" aria-label="Toggle reader view"><span class="icon icon-newspaper"></span></button></li>` : ''}
          <li><button class="share-btn" type="button" aria-label="Share article"><span class="icon icon-share"></span></button></li>
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
    // External link — metadata + auto-load reader view
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
      <div class="article-reader active">
        <p class="reader-loading">Loading reader view…</p>
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

  // Share button click handler
  const shareBtn = page.querySelector('.share-btn') as HTMLElement | null;
  if (shareBtn) {
    shareBtn.addEventListener('click', (event: MouseEvent) => {
      event.preventDefault();
      shareArticle();
    });
  }

  // For external articles: auto-load reader content + toggle button
  if (hasExternalUrl && article.url) {
    const readerBtn = page.querySelector('.reader-toggle') as HTMLElement | null;
    const readerContainer = page.querySelector('.article-reader') as HTMLElement | null;

    if (readerContainer) {
      loadReaderContent(article.url, readerContainer);
    }

    if (readerBtn && readerContainer) {
      let readerActive = true;

      readerBtn.addEventListener('click', () => {
        if (readerActive) {
          readerContainer.classList.remove('active');
          readerBtn.classList.remove('active');
          readerActive = false;
        } else {
          readerContainer.classList.add('active');
          readerBtn.classList.add('active');
          readerActive = true;
        }
      });
    }
  }
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
