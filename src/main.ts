// Main application entry point
import './styles/normalize.css';
import './styles/common.css';
import './styles/pages.css';
import './styles/dark.css';

import { config } from './config';
import { PubSub } from './utils/pubsub';
import { template, prerender } from './utils/template';
import { timeAgo } from './utils/time';
import { data } from './modules/data';
import { perf } from './modules/performance';
import { loading } from './modules/ui';
import Cookies from 'js-cookie';

// Add HTML class to show app
document.querySelector('html')?.classList.add('show-app');

// Initialize theme
const theme = Cookies.get('theme') || 'default';
const fontSize = Cookies.get('fontsize') || 'normal';
const htmlNode = document.querySelector('html');
if (htmlNode) {
  htmlNode.classList.add(`theme-${theme}`, `font-${fontSize}`);
  htmlNode.setAttribute('data-theme', theme);
  htmlNode.setAttribute('data-font-size', fontSize);
}

// Auto-hide read comments
const hideReadComment = Cookies.get('hideReadComment') || 'yes';
if (hideReadComment === 'yes' && htmlNode) {
  htmlNode.classList.add('hide-comment-visited');
}

// Export global API for compatibility
declare global {
  interface Window {
    $hn: {
      config: typeof config;
      PubSub: typeof PubSub;
      template: typeof template;
      prerender: typeof prerender;
      timeAgo: typeof timeAgo;
      data: typeof data;
      perf: typeof perf;
      loading: typeof loading;
    };
  }
}

window.$hn = {
  config,
  PubSub,
  template,
  prerender,
  timeAgo,
  data,
  perf,
  loading
};

// Simple click handler for links
function setupClickHandlers(): void {
  document.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a');
    
    if (link && link.getAttribute('href')?.startsWith('#')) {
      event.preventDefault();
      
      const href = link.getAttribute('href') || '';
      const parts = href.substring(1).split('/');
      
      if (parts.length >= 2) {
        const action = parts[0];
        const id = parts[1];
        
        if (action === 'article' || action === 'comments') {
          loading.show(event.clientX, event.clientY);
          PubSub.publish(`show-${action}`, Number(id));
        }
      }
    }
  });
}

// Initialize home page
function initHomePage(): void {
  const homePage = document.querySelector('.page-home');
  const homePageBody = homePage?.querySelector('.bd');
  
  if (!homePage || !homePageBody) {
    console.error('Home page elements not found');
    return;
  }

  const listItemTemplate = document.querySelector('.template-list-item')?.innerHTML || '';
  const listItemRender = prerender(listItemTemplate);

  PubSub.subscribe('load-home', () => {
    data.getArticles((items) => {
      const html = items.map(item => {
        if (item.domain && item.url) {
          item.self = false;
          item.urlTitle = item.url.replace(/^https?:\/\//, '');
        } else {
          item.self = true;
          item.urlTitle = '';
        }
        item.text = item.text || '';
        return item.id ? listItemRender(item) : '';
      }).join('');

      loading.hide();
      homePageBody.innerHTML = `<ul class="list">${html}</ul>`;
      homePage.classList.add('show-page');
    });
  });
}

// Initialize the application
function init(): void {
  console.log('Initializing Hacker News Reader v' + config.v.app);
  
  setupClickHandlers();
  initHomePage();
  
  // Load home page on start
  setTimeout(() => {
    PubSub.publish('load-home');
  }, 100);
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default {};
