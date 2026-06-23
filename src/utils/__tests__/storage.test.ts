import { describe, it, expect, vi } from 'vitest';
import { store } from '../storage';

describe('store', () => {
  describe('get', () => {
    it('returns null for missing keys', () => {
      expect(store.get('nonexistent')).toBeNull();
    });

    it('returns parsed JSON for stored values', () => {
      localStorage.setItem('test', JSON.stringify({ foo: 'bar' }));
      expect(store.get('test')).toEqual({ foo: 'bar' });
    });

    it('returns null for invalid JSON', () => {
      localStorage.setItem('bad', 'not-json{{{');
      expect(store.get('bad')).toBeNull();
    });

    it('handles primitives', () => {
      localStorage.setItem('num', JSON.stringify(42));
      localStorage.setItem('str', JSON.stringify('hello'));
      localStorage.setItem('bool', JSON.stringify(true));
      expect(store.get('num')).toBe(42);
      expect(store.get('str')).toBe('hello');
      expect(store.get('bool')).toBe(true);
    });
  });

  describe('set', () => {
    it('stores JSON-serialized values', () => {
      store.set('key', { a: 1 });
      expect(localStorage.setItem).toHaveBeenCalledWith('key', '{"a":1}');
    });

    it('handles arrays', () => {
      store.set('arr', [1, 2, 3]);
      expect(localStorage.getItem('arr')).toBe('[1,2,3]');
    });

    it('handles null values gracefully', () => {
      store.set('nil', null);
      expect(localStorage.getItem('nil')).toBe('null');
    });

    it('logs an error when localStorage.setItem throws and does not crash', () => {
      const error = new Error('quota exceeded');
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw error;
      });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        expect(() => store.set('key', 'value')).not.toThrow();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Storage error:', error);
      } finally {
        consoleErrorSpy.mockRestore();
        localStorage.setItem = originalSetItem;
      }
    });
  });

  describe('remove', () => {
    it('removes a key from storage', () => {
      store.set('temp', 'value');
      store.remove('temp');
      expect(store.get('temp')).toBeNull();
    });
  });

  describe('clear', () => {
    it('clears all storage', () => {
      store.set('a', 1);
      store.set('b', 2);
      store.clear();
      expect(store.get('a')).toBeNull();
      expect(store.get('b')).toBeNull();
    });
  });
});
