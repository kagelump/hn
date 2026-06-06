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
          <p>Version ${config.v.app}</p>
          <h3>Data Source</h3>
          <p>Powered by the official <a href="https://github.com/HackerNews/API" target="_blank" rel="noopener noreferrer">Hacker News Firebase API</a>.</p>
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
