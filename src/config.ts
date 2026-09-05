// Application configuration
import { store } from './utils/storage';
import { version } from '../package.json';

export interface AppConfig {
  url: {
    stories: string;
  };
  version: string;
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
  // Embedded at build time, matching the release and OTA bundle version.
  version,
  hnid
};

export default config;
