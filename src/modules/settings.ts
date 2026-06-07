// Settings page module
import { Capacitor } from '@capacitor/core';
import { showPage } from './router';
import { PubSub } from '../utils/pubsub';
import { store } from '../utils/storage';
import { config } from '../config';
import { escapeHtml } from '../utils/template';

const THEMES = ['default', 'dark'];
const FONT_FAMILIES = [
  { id: 'source-sans', name: 'Source Sans Pro', css: "'Source Sans Pro', Helvetica Neue, Segoe UI, Arial, sans-serif" },
  { id: 'roboto-slab', name: 'Roboto Slab', css: "'Roboto Slab', Georgia, serif" },
  { id: 'open-sans', name: 'Open Sans', css: "'Open Sans', Helvetica Neue, Segoe UI, Arial, sans-serif" },
  { id: 'sf', name: 'San Francisco', css: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" }
];

const THEME_COLORS = [
  // Row 1
  '#ff6600', '#808080', '#a0a0a0', '#c0c0c0', '#e88090', '#b71c1c', '#e53935',
  // Row 2
  '#e57373', '#ff5252', '#ff8a65', '#ff7043', '#ff8a80', '#ff6e40', '#a1887f',
  // Row 3
  '#ffb74d', '#ffa726', '#d4a04a', '#ffc107', '#ffca28', '#9e9d24', '#8bc34a',
  // Row 4
  '#aed581', '#66bb6a', '#4caf50', '#2e7d32', '#1b5e20', '#009688', '#4dd0e1',
  // Row 5
  '#26a69a', '#00897b', '#00796b', '#004d40', '#0097a7', '#0097a7', '#546e7a',
  // Row 6
  '#26c6da', '#29b6f6', '#2196f3', '#1565c0', '#0d47a1', '#303f9f', '#3f51b5',
  // Row 7
  '#7986cb', '#5c6bc0', '#3f51b5', '#1a237e', '#673ab7', '#9575cd', '#7e57c2',
  // Row 8
  '#6a1b9a', '#ab47bc', '#ba68c8', '#ce93d8', '#e1bee7', '#ec407a', '#f06292',
  // Row 9
  '#d81b60', '#c2185b', '#880e4f', '#ff1744', '#f50057', '#e91e63', '#d50000',
  // Row 10
  '#ff1744', '#ef5350', '#c62828', '#b71c1c'
];

function applyTheme(theme: string): void {
  const html = document.querySelector('html');
  if (!html) return;
  THEMES.forEach(t => html.classList.remove(`theme-${t}`));
  html.classList.add(`theme-${theme}`);
  html.setAttribute('data-theme', theme);
  store.set('theme', theme);
}

function applyFontFamily(fontId: string): void {
  const html = document.querySelector('html');
  if (!html) return;
  const font = FONT_FAMILIES.find(f => f.id === fontId);
  if (font) {
    html.style.fontFamily = font.css;
    html.setAttribute('data-font-family', fontId);
    store.set('fontFamily', fontId);
  }
}

function applyTextSize(size: number): void {
  const html = document.querySelector('html');
  if (!html) return;
  html.style.fontSize = `${size}px`;
  html.setAttribute('data-text-size', String(size));
  store.set('textSize', size);
}

function applyThemeColor(color: string): void {
  const html = document.querySelector('html');
  if (!html) return;
  html.style.setProperty('--theme-color', color);
  html.setAttribute('data-theme-color', color);
  store.set('themeColor', color);
}

function applyAnimation(enabled: boolean): void {
  const html = document.querySelector('html');
  if (!html) return;
  html.classList.toggle('no-animation', !enabled);
  store.set('animation', enabled ? 'yes' : 'no');
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
  const currentFontFamily = store.get<string>('fontFamily') || 'source-sans';
  const currentTextSize = store.get<number>('textSize') || 15;
  const currentThemeColor = store.get<string>('themeColor') || '#ff6600';
  const animationEnabled = store.get<string>('animation') !== 'no';
  const hideRead = store.get<string>('hideReadComment') || 'yes';
  const isNative = Capacitor.isNativePlatform();
  const corsProxy = store.get<string>('corsProxy') || 'https://api.allorigins.win/raw?url=';

  const fontFamilyHtml = FONT_FAMILIES.map(f => `
    <li class="setting-radio" data-font-family="${f.id}">
      <span class="radio-dot${f.id === currentFontFamily ? ' selected' : ''}"></span>
      <span class="radio-label" style="font-family:${f.css}">${f.name}</span>
    </li>
  `).join('');

  const textSizeHtml = THEME_COLORS.map((color) => {
    const isSelected = color === currentThemeColor;
    return `<div class="color-swatch${isSelected ? ' selected' : ''}" data-color="${color}" style="background:${color}">
      ${isSelected ? '<span class="color-dot"></span>' : ''}
    </div>`;
  }).join('');

  const themeHtml = THEMES.map(t => `
    <li class="setting-radio" data-theme="${t}">
      <span class="radio-dot${t === currentTheme ? ' selected' : ''}"></span>
      <span class="radio-label">${t === 'default' ? 'Light' : 'Dark'}</span>
    </li>
  `).join('');

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
      <div class="bd settings-page">
        <div class="settings-section">
          <h3 class="settings-section-title">Font Style</h3>
          <ul class="settings-radio-list">${fontFamilyHtml}</ul>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Text Size</h3>
          <div class="text-size-control">
            <input type="range" id="text-size-slider" min="13" max="23" value="${currentTextSize}" class="text-size-slider">
            <span class="text-size-value">${currentTextSize}px</span>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Theme</h3>
          <ul class="settings-radio-list">${themeHtml}</ul>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Theme Color</h3>
          <div class="color-grid">${textSizeHtml}</div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Animation</h3>
          <ul class="settings-radio-list">
            <li class="setting-radio" data-animation="yes">
              <span class="radio-dot${animationEnabled ? ' selected' : ''}"></span>
              <span class="radio-label">Enable</span>
            </li>
            <li class="setting-radio" data-animation="no">
              <span class="radio-dot${!animationEnabled ? ' selected' : ''}"></span>
              <span class="radio-label">Disable</span>
            </li>
          </ul>
        </div>

        <div class="settings-section">
          <ul class="settings-radio-list">
            <li class="setting-item-inline">
              <span>Auto-hide read comments</span>
              <input type="checkbox" id="hide-read" ${hideRead === 'yes' ? 'checked' : ''}>
            </li>
          </ul>
        </div>

        ${!isNative ? `
        <div class="settings-section">
          <h3 class="settings-section-title">CORS Proxy URL</h3>
          <input type="url" id="cors-proxy" class="settings-text-input" value="${escapeHtml(corsProxy)}" placeholder="https://api.allorigins.win/raw?url=">
        </div>
        ` : ''}

        <div class="settings-version">
          <p>Version ${config.v.app}-${config.v.js}-${config.v.css}</p>
        </div>
      </div>
    </section>
  `;

  // Font family radio buttons
  page.querySelectorAll('[data-font-family]').forEach(el => {
    el.addEventListener('click', () => {
      const fontId = el.getAttribute('data-font-family')!;
      applyFontFamily(fontId);
      page.querySelectorAll('[data-font-family] .radio-dot').forEach(d => d.classList.remove('selected'));
      el.querySelector('.radio-dot')?.classList.add('selected');
    });
  });

  // Text size slider
  const slider = page.querySelector('#text-size-slider') as HTMLInputElement | null;
  const sliderValue = page.querySelector('.text-size-value') as HTMLElement | null;
  slider?.addEventListener('input', () => {
    const size = Number(slider.value);
    applyTextSize(size);
    if (sliderValue) sliderValue.textContent = `${size}px`;
  });

  // Theme radio buttons
  page.querySelectorAll('[data-theme]').forEach(el => {
    el.addEventListener('click', () => {
      const theme = el.getAttribute('data-theme')!;
      applyTheme(theme);
      page.querySelectorAll('[data-theme] .radio-dot').forEach(d => d.classList.remove('selected'));
      el.querySelector('.radio-dot')?.classList.add('selected');
    });
  });

  // Theme color grid
  page.querySelectorAll('.color-swatch').forEach(el => {
    el.addEventListener('click', () => {
      const color = el.getAttribute('data-color')!;
      applyThemeColor(color);
      page.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.remove('selected');
        const dot = s.querySelector('.color-dot');
        if (dot) dot.remove();
      });
      el.classList.add('selected');
      el.insertAdjacentHTML('beforeend', '<span class="color-dot"></span>');
    });
  });

  // Animation toggle
  page.querySelectorAll('[data-animation]').forEach(el => {
    el.addEventListener('click', () => {
      const enabled = el.getAttribute('data-animation') === 'yes';
      applyAnimation(enabled);
      page.querySelectorAll('[data-animation] .radio-dot').forEach(d => d.classList.remove('selected'));
      el.querySelector('.radio-dot')?.classList.add('selected');
    });
  });

  // Hide read comments
  const hideReadCheckbox = page.querySelector('#hide-read') as HTMLInputElement | null;
  hideReadCheckbox?.addEventListener('change', () => applyHideReadComments(hideReadCheckbox.checked));

  // CORS proxy
  if (!isNative) {
    const corsProxyInput = page.querySelector('#cors-proxy') as HTMLInputElement | null;
    corsProxyInput?.addEventListener('change', () => {
      store.set('corsProxy', corsProxyInput.value);
    });
  }
}

export function initSettingsPage(): void {
  PubSub.subscribe('show-settings', () => {
    showPage('page-settings', 'Settings');
    renderSettingsPage();
  });
}
