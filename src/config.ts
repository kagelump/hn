// Application configuration
import type { AppConfig } from './types/index.js';
import Cookies from 'js-cookie';
import { store } from './utils/storage.js';

// Generate unique ID
function generateHnid(): string {
  return '_' + Math.random().toString(36).substring(2, 11);
}

// Initialize unique ID
let hnid = Cookies.get('hnid') || store.get<string>('hnid');
if (Cookies.get('hnid')) {
  Cookies.remove('hnid');
  if (hnid) {
    store.set('hnid', hnid);
  }
}
if (!hnid) {
  hnid = generateHnid();
  store.set('hnid', hnid);
}

export const config: AppConfig = {
  version: 2,
  nativeApp: false,
  iScrollEnable: false,
  apikey: 'localhost.com',
  url: {
    stories: 'http://ng.premii.com:8080',
    share: 'http://hn.premii.com',
    readability: 'a/read/sample.txt'
  },
  v: {
    js: 0.2,
    css: 0.05,
    app: 2
  },
  hnid
};

config.url.storiesBackup = config.url.stories;

export default config;
