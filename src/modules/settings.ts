// Settings page module
import { showPage } from './router';
import { PubSub } from '../utils/pubsub';
import { store } from '../utils/storage';
import { config } from '../config';

const THEMES = ['default', 'dark'];
const FONT_SIZES = ['normal', 'large', 'x-large'];

function applyTheme(theme: string): void {
  const html = document.querySelector('html');
  if (!html) return;
  THEMES.forEach(t => html.classList.remove(`theme-${t}`));
  html.classList.add(`theme-${theme}`);
  html.setAttribute('data-theme', theme);
  store.set('theme', theme);
}

function applyFontSize(size: string): void {
  const html = document.querySelector('html');
  if (!html) return;
  FONT_SIZES.forEach(s => html.classList.remove(`font-${s}`));
  html.classList.add(`font-${size}`);
  html.setAttribute('data-font-size', size);
  store.set('fontsize', size);
}

function applyHideReadComments(hide: boolean): void {
  const html = document.querySelector('html');
  if (!html) return;
  html.classList.toggle('hide-comment-visited', hide);
  store.set('hideReadComment', hide ? 'yes' : 'no');
}

function renderSettingsPage(): void {
  const page = document.querySelector('.page-settings') as HTMLElement | null;
  if (!page) return;

  const currentTheme = store.get<string>('theme') || 'default';
  const currentFontSize = store.get<string>('fontsize') || 'normal';
  const hideRead = store.get<string>('hideReadComment') || 'yes';

  const themeOptions = THEMES.map(t =>
    `<option value="${t}" ${t === currentTheme ? 'selected' : ''}>${t}</option>`
  ).join('');

  const fontOptions = FONT_SIZES.map(s =>
    `<option value="${s}" ${s === currentFontSize ? 'selected' : ''}>${s}</option>`
  ).join('');

  page.innerHTML = `
    <div class="header-container">
      <header class="header">
        <ul class="l-menu list-inline menu">
          <li><a href="#/" class="back-home"><span class="icon icon-arrow-left"></span></a></li>
        </ul>
        <h1>Settings</h1>
        <ul class="r-menu list-inline menu"></ul>
      </header>
    </div>
    <section class="pagebd-container">
      <div class="bd">
        <ul class="settings-list">
          <li class="setting-item">
            <label for="theme-select">Theme</label>
            <select id="theme-select">${themeOptions}</select>
          </li>
          <li class="setting-item">
            <label for="font-select">Font Size</label>
            <select id="font-select">${fontOptions}</select>
          </li>
          <li class="setting-item">
            <label for="hide-read">Auto-hide read comments</label>
            <input type="checkbox" id="hide-read" ${hideRead === 'yes' ? 'checked' : ''}>
          </li>
        </ul>
        <div class="settings-version">
          <p>Version ${config.v.app}-${config.v.js}-${config.v.css}</p>
        </div>
      </div>
    </section>
  `;

  // Event handlers
  const themeSelect = page.querySelector('#theme-select') as HTMLSelectElement | null;
  const fontSelect = page.querySelector('#font-select') as HTMLSelectElement | null;
  const hideReadCheckbox = page.querySelector('#hide-read') as HTMLInputElement | null;

  themeSelect?.addEventListener('change', () => applyTheme(themeSelect.value));
  fontSelect?.addEventListener('change', () => applyFontSize(fontSelect.value));
  hideReadCheckbox?.addEventListener('change', () => applyHideReadComments(hideReadCheckbox.checked));
}

export function initSettingsPage(): void {
  PubSub.subscribe('show-settings', () => {
    showPage('page-settings', 'Settings');
    renderSettingsPage();
  });
}
