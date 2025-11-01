// Type definitions for the Hacker News app

export interface HNItem {
  id: number;
  title: string;
  points: number | string;
  user: string;
  time_ago: string;
  url?: string;
  domain?: string;
  urlTitle?: string;
  self: boolean;
  comments_count: number;
  content?: string;
  text?: string;
  type?: string;
  visitedArticle?: string;
  visitedComments?: string;
  article?: string;
  comments?: HNComment[];
  commentsFetchTime?: number;
  lastReadComment?: number;
}

export interface HNComment {
  id: number;
  user: string;
  time_ago: string;
  content: string;
  comments?: HNComment[];
}

export interface AppConfig {
  version: number;
  nativeApp: boolean;
  iScrollEnable: boolean;
  apikey: string;
  url: {
    stories: string;
    share: string;
    readability: string;
    storiesBackup?: string;
  };
  v: {
    js: number;
    css: number;
    app: number;
  };
  hnid: string | null;
}

export interface VisitedItem {
  a?: number; // article visit timestamp
  c?: number; // comments visit timestamp
  lastReadComment?: number;
}

export interface VisitedData {
  [id: string]: VisitedItem | number | undefined;
  version?: number;
}

export interface PerformanceData {
  [key: string]: string | number | Record<string, string | number>;
}

export interface LocalData {
  list?: HNItem[];
  articles: Record<number, HNItem>;
  [key: string]: any;
}
