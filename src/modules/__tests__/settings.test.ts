import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) }
}));

import { Capacitor } from '@capacitor/core';
import {
  applyTheme,
  applyFontFamily,
  applyTextSize,
  applyThemeColor,
  applyAnimation,
  applyHideReadComments,
  applyTextBrightness,
  renderSettingsPage,
  initSettingsPage
} from '../settings';
import { store } from '../../utils/storage';
import { PubSub } from '../../utils/pubsub';

const isNativePlatform = Capacitor.isNativePlatform as unknown as Mock;

function resetHtml(): void {
  const html = document.documentElement;
  html.className = '';
  html.style.cssText = '';
  for (const attr of Array.from(html.attributes)) {
    if (attr.name.startsWith('data-')) {
      html.removeAttribute(attr.name);
    }
  }
}

describe('settings apply functions', () => {
  beforeEach(() => {
    resetHtml();
    isNativePlatform.mockReturnValue(false);
  });

  describe('applyTheme', () => {
    it('sets the theme class and data attribute and stores the value', () => {
      applyTheme('dark');
      expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(store.get('theme')).toBe('dark');
    });

    it('removes previous theme classes before applying a new one', () => {
      applyTheme('dark');
      applyTheme('default');
      expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
      expect(document.documentElement.classList.contains('theme-default')).toBe(true);
    });
  });

  describe('applyFontFamily', () => {
    it('applies a known font and stores the id', () => {
      applyFontFamily('roboto-slab');
      expect(document.documentElement.style.fontFamily).toContain('Roboto Slab');
      expect(document.documentElement.getAttribute('data-font-family')).toBe('roboto-slab');
      expect(store.get('fontFamily')).toBe('roboto-slab');
    });

    it('does nothing for an unknown font id', () => {
      document.documentElement.style.fontFamily = 'monospace';
      applyFontFamily('unknown-font');
      expect(document.documentElement.style.fontFamily).toBe('monospace');
      expect(store.get('fontFamily')).toBeNull();
    });
  });

  describe('applyTextSize', () => {
    it('sets font size, data attribute and stores the value', () => {
      applyTextSize(18);
      expect(document.documentElement.style.fontSize).toBe('18px');
      expect(document.documentElement.getAttribute('data-text-size')).toBe('18');
      expect(store.get('textSize')).toBe(18);
    });
  });

  describe('applyThemeColor', () => {
    it('sets the css custom property, data attribute and stores the value', () => {
      applyThemeColor('#2196f3');
      expect(document.documentElement.style.getPropertyValue('--theme-color')).toBe('#2196f3');
      expect(document.documentElement.getAttribute('data-theme-color')).toBe('#2196f3');
      expect(store.get('themeColor')).toBe('#2196f3');
    });
  });

  describe('applyAnimation', () => {
    it('removes no-animation class when enabled and stores yes', () => {
      document.documentElement.classList.add('no-animation');
      applyAnimation(true);
      expect(document.documentElement.classList.contains('no-animation')).toBe(false);
      expect(store.get('animation')).toBe('yes');
    });

    it('adds no-animation class when disabled and stores no', () => {
      applyAnimation(false);
      expect(document.documentElement.classList.contains('no-animation')).toBe(true);
      expect(store.get('animation')).toBe('no');
    });
  });

  describe('applyHideReadComments', () => {
    it('adds hide class when true and stores yes', () => {
      applyHideReadComments(true);
      expect(document.documentElement.classList.contains('hide-comment-visited')).toBe(true);
      expect(store.get('hideReadComment')).toBe('yes');
    });

    it('removes hide class when false and stores no', () => {
      document.documentElement.classList.add('hide-comment-visited');
      applyHideReadComments(false);
      expect(document.documentElement.classList.contains('hide-comment-visited')).toBe(false);
      expect(store.get('hideReadComment')).toBe('no');
    });
  });

  describe('applyTextBrightness', () => {
    it('sets the css custom property and stores the value', () => {
      applyTextBrightness(75);
      expect(document.documentElement.style.getPropertyValue('--text-brightness')).toBe('75');
      expect(store.get('textBrightness')).toBe(75);
    });
  });
});

describe('renderSettingsPage', () => {
  beforeEach(() => {
    resetHtml();
    isNativePlatform.mockReturnValue(false);
  });

  function createPage(): HTMLElement {
    document.body.innerHTML = '<div class="page-settings"></div>';
    return document.querySelector('.page-settings') as HTMLElement;
  }

  it('renders the settings form into the page container', () => {
    createPage();
    renderSettingsPage();
    const page = document.querySelector('.page-settings') as HTMLElement;
    expect(page.innerHTML).toContain('Font Style');
    expect(page.innerHTML).toContain('Text Size');
    expect(page.innerHTML).toContain('Theme');
    expect(page.innerHTML).toContain('Theme Color');
    expect(page.innerHTML).toContain('Animation');
  });

  it('reflects pre-seeded non-default store values', () => {
    store.set('theme', 'dark');
    store.set('fontFamily', 'sf');
    store.set('textSize', 21);
    store.set('themeColor', '#2196f3');
    store.set('animation', 'no');
    store.set('hideReadComment', 'no');
    store.set('textBrightness', 80);

    createPage();
    renderSettingsPage();

    expect(document.querySelector('[data-theme="dark"] .radio-dot')?.classList.contains('selected')).toBe(true);
    expect(document.querySelector('[data-font-family="sf"] .radio-dot')?.classList.contains('selected')).toBe(true);
    expect((document.querySelector('#text-size-slider') as HTMLInputElement)?.value).toBe('21');
    expect(document.querySelector('.text-size-value')?.textContent).toBe('21px');
    expect((document.querySelector('#text-brightness-slider') as HTMLInputElement)?.value).toBe('80');
    expect(document.querySelector('#text-brightness-value')?.textContent).toBe('80%');
    expect(document.querySelector('[data-color="#2196f3"]')?.classList.contains('selected')).toBe(true);
    expect(document.querySelector('[data-animation="no"] .radio-dot')?.classList.contains('selected')).toBe(true);
    expect((document.querySelector('#hide-read') as HTMLInputElement)?.checked).toBe(false);
  });

  it('shows the cors proxy input on non-native platforms', () => {
    isNativePlatform.mockReturnValue(false);
    createPage();
    renderSettingsPage();
    expect(document.querySelector('#cors-proxy')).not.toBeNull();
  });

  it('hides the cors proxy input on native platforms', () => {
    isNativePlatform.mockReturnValue(true);
    createPage();
    renderSettingsPage();
    expect(document.querySelector('#cors-proxy')).toBeNull();
  });

  it('updates font family when a font radio is clicked', () => {
    createPage();
    renderSettingsPage();
    const radio = document.querySelector('[data-font-family="open-sans"]') as HTMLElement;
    radio.click();
    expect(document.documentElement.style.fontFamily).toContain('Open Sans');
    expect(document.documentElement.getAttribute('data-font-family')).toBe('open-sans');
    expect(radio.querySelector('.radio-dot')?.classList.contains('selected')).toBe(true);
  });

  it('updates text size when the slider emits an input event', () => {
    createPage();
    renderSettingsPage();
    const slider = document.querySelector('#text-size-slider') as HTMLInputElement;
    slider.value = '19';
    slider.dispatchEvent(new Event('input'));
    expect(document.documentElement.style.fontSize).toBe('19px');
    expect(document.querySelector('.text-size-value')?.textContent).toBe('19px');
    expect(store.get('textSize')).toBe(19);
  });

  it('updates theme color when a color swatch is clicked', () => {
    createPage();
    renderSettingsPage();
    const swatch = document.querySelector('[data-color="#4caf50"]') as HTMLElement;
    swatch.click();
    expect(document.documentElement.style.getPropertyValue('--theme-color')).toBe('#4caf50');
    expect(document.documentElement.getAttribute('data-theme-color')).toBe('#4caf50');
    expect(swatch.classList.contains('selected')).toBe(true);
    expect(swatch.querySelector('.color-dot')).not.toBeNull();
  });

  it('toggles hide read comments when the checkbox changes', () => {
    createPage();
    renderSettingsPage();
    const checkbox = document.querySelector('#hide-read') as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(document.documentElement.classList.contains('hide-comment-visited')).toBe(false);
    expect(store.get('hideReadComment')).toBe('no');

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(document.documentElement.classList.contains('hide-comment-visited')).toBe(true);
    expect(store.get('hideReadComment')).toBe('yes');
  });

  it('updates text brightness when the brightness slider emits an input event', () => {
    createPage();
    renderSettingsPage();
    const slider = document.querySelector('#text-brightness-slider') as HTMLInputElement;
    slider.value = '60';
    slider.dispatchEvent(new Event('input'));
    expect(document.documentElement.style.getPropertyValue('--text-brightness')).toBe('60');
    expect(document.querySelector('#text-brightness-value')?.textContent).toBe('60%');
    expect(store.get('textBrightness')).toBe(60);
  });

  it('updates theme when a theme radio is clicked and reapplies brightness', () => {
    store.set('textBrightness', 70);
    createPage();
    renderSettingsPage();
    const radio = document.querySelector('[data-theme="dark"]') as HTMLElement;
    radio.click();
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--text-brightness')).toBe('70');
    expect(radio.querySelector('.radio-dot')?.classList.contains('selected')).toBe(true);
  });

  it('updates animation preference when an animation radio is clicked', () => {
    createPage();
    renderSettingsPage();
    const radio = document.querySelector('[data-animation="no"]') as HTMLElement;
    radio.click();
    expect(document.documentElement.classList.contains('no-animation')).toBe(true);
    expect(store.get('animation')).toBe('no');
    expect(radio.querySelector('.radio-dot')?.classList.contains('selected')).toBe(true);
  });

  it('stores the cors proxy url when the input emits a change event', () => {
    createPage();
    renderSettingsPage();
    const input = document.querySelector('#cors-proxy') as HTMLInputElement;
    input.value = 'https://my-proxy.test/?url=';
    input.dispatchEvent(new Event('change'));
    expect(store.get('corsProxy')).toBe('https://my-proxy.test/?url=');
  });
});

describe('initSettingsPage', () => {
  beforeEach(() => {
    PubSub.clear();
    document.body.innerHTML = '<div class="page page-settings"></div>';
  });

  afterEach(() => {
    PubSub.clear();
  });

  it('subscribes to show-settings and shows/renders the settings page', () => {
    initSettingsPage();
    PubSub.publish('show-settings');

    expect(document.title).toBe('Settings');
    const page = document.querySelector('.page-settings') as HTMLElement;
    expect(page.classList.contains('show-page')).toBe(true);
    expect(page.innerHTML).toContain('Font Style');
  });
});
