// Type definitions for the Hacker News app

// Raw item from the HN Firebase API
export interface FirebaseItem {
  id: number;
  by?: string;
  title?: string;
  url?: string;
  text?: string;
  score?: number;
  time?: number;
  type?: string;
  descendants?: number;
  kids?: number[];
  parent?: number;
  dead?: boolean;
  deleted?: boolean;
}

// App-facing comment type
export interface HNComment {
  id: number;
  user: string;
  time_ago: string;
  content: string;
  comments?: HNComment[];
  colorClass?: string;
}

// App-facing item type (transformed from FirebaseItem)
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
  text?: string;
  type?: string;
  visitedArticle?: string;
  visitedComments?: string;
  comments?: HNComment[];
  commentsFetchTime?: number;
  lastReadComment?: number;
  kids?: number[];
  allKids?: number[];
  fetchedKidsCount?: number;
  allCommentsLoaded?: boolean;
  sortWarning?: string;
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
  [key: string]: unknown;
}
