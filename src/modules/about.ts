// About page module
import { showPage } from './router';
import { PubSub } from '../utils/pubsub';
import { config } from '../config';

function renderAboutPage(): void {
  const page = document.querySelector('.page-about') as HTMLElement | null;
  if (!page) return;

  page.innerHTML = `
    <div class="header-container">
      <header class="header">
        <ul class="l-menu list-inline menu">
          <li><a href="#/" class="back-home"><span class="icon icon-arrow-left"></span></a></li>
        </ul>
        <h1>About</h1>
        <ul class="r-menu list-inline menu"></ul>
      </header>
    </div>
    <section class="pagebd-container">
      <div class="bd">
        <div class="about-content">
          <h2>HN Reader</h2>
          <p>A fast, lightweight Hacker News reader web app.</p>
          <p>Forked from <a href="https://github.com/premii/hn" target="_blank" rel="noopener noreferrer">github.com/premii/hn</a>.</p>
          <p>Version ${config.v.app}</p>
          <h3>Data Sources</h3>
          <p>Story data via the official <a href="https://github.com/HackerNews/API" target="_blank" rel="noopener noreferrer">Hacker News Firebase API</a>.</p>
          <p>Comment trees via the <a href="https://hn.algolia.com/api" target="_blank" rel="noopener noreferrer">HN Search API</a> by Algolia.</p>
          <h3>Content &amp; Moderation</h3>
          <p>HN Reader is a read-only client. It displays public content from Hacker News, which is a moderated platform governed by the <a href="https://news.ycombinator.com/newsguidelines.html" target="_blank" rel="noopener noreferrer">Hacker News guidelines</a>. You can also tap any author's name on a story or comment to block that user — their stories are hidden and their comments are replaced with “[blocked]”.</p>
          <p><a href="https://kagelump.github.io/hn/support/" target="_blank" rel="noopener noreferrer">Support &amp; Content Policy</a></p>
          <p><a href="https://kagelump.github.io/hn/privacy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a></p>
          <h3>Open Source Licenses</h3>
          <p>Reader mode powered by <a href="https://github.com/mozilla/readability" target="_blank" rel="noopener noreferrer">Mozilla's Readability</a> library, originally by Arc90 Inc, used under the <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer">Apache License 2.0</a>.</p>
        </div>
      </div>
    </section>
  `;
}

export function initAboutPage(): void {
  PubSub.subscribe('show-about', () => {
    showPage('page-about', 'About');
    renderAboutPage();
  });
}
