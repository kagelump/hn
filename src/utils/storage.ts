// Storage utility functions using localStorage

const storage = window.localStorage;

export const store = {
  get<T>(key: string): T | null {
    try {
      const item = storage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage error:', error);
    }
  },

  remove(key: string): void {
    storage.removeItem(key);
  },

  clear(): void {
    storage.clear();
  }
};
