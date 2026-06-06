// Application configuration
import { store } from './utils/storage';

export interface AppConfig {
  url: {
    stories: string;
  };
  v: {
    js: number;
    css: number;
    app: number;
  };
  hnid: string | null;
}

// Generate unique ID
function generateHnid(): string {
  return '_' + Math.random().toString(36).substring(2, 11);
}

// Initialize unique ID from localStorage
let hnid = store.get<string>('hnid');
if (!hnid) {
  hnid = generateHnid();
  store.set('hnid', hnid);
}

export const config: AppConfig = {
  url: {
    stories: 'https://hacker-news.firebaseio.com/v0'
  },
  v: {
    js: 0.2,
    css: 0.05,
    app: 2
  },
  hnid
};

export default config;
