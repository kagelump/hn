import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { FirebaseItem } from '../../types';

// Mock fetch globally
const mockFetch = vi.fn() as Mock;
global.fetch = mockFetch;

// Mock performance module
vi.mock('../performance', () => ({
  perf: {
    update: vi.fn(),
    data: {}
  }
}));

// Import after mocks are set up
import { data } from '../data';

function mockFetchResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body)
  });
}

const sampleFirebaseItem: FirebaseItem = {
  id: 1001,
  by: 'testuser',
  title: 'Test Article',
  url: 'https://example.com/article',
  score: 42,
  time: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  type: 'story',
  descendants: 5,
  kids: [2001, 2002]
};

const sampleAskItem: FirebaseItem = {
  id: 1002,
  by: 'asker',
  title: 'Ask HN: What is life?',
  text: 'Seriously, what is it?',
  score: 10,
  time: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
  type: 'story',
  descendants: 3,
  kids: [3001]
};

const sampleComment: FirebaseItem = {
  id: 2001,
  by: 'commenter',
  text: 'Great article!',
  time: Math.floor(Date.now() / 1000) - 1800, // 30 mins ago
  type: 'comment',
  parent: 1001,
  kids: [2003]
};

const sampleNestedComment: FirebaseItem = {
  id: 2003,
  by: 'replier',
  text: 'I agree!',
  time: Math.floor(Date.now() / 1000) - 900, // 15 mins ago
  type: 'comment',
  parent: 2001
};

const deletedComment: FirebaseItem = {
  id: 2002,
  deleted: true,
  time: Math.floor(Date.now() / 1000),
  type: 'comment'
};

const deadComment: FirebaseItem = {
  id: 2099,
  by: 'spammer',
  text: 'Buy stuff',
  dead: true,
  time: Math.floor(Date.now() / 1000),
  type: 'comment'
};

describe('data module', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Clear the module's internal cache by re-importing would be complex,
    // so we test the observable behavior
  });

  describe('getArticles', () => {
    it('fetches story IDs then items, returns transformed list', async () => {
      // First call: story IDs
      // Then 2 calls for individual items
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([1001, 1002]))
        .mockImplementationOnce(() => mockFetchResponse(sampleFirebaseItem))
        .mockImplementationOnce(() => mockFetchResponse(sampleAskItem));

      const items = await new Promise<unknown[]>((resolve) => {
        data.getArticles((list) => resolve(list), true);
      });

      expect(items).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify transform
      const first = items[0] as Record<string, unknown>;
      expect(first.id).toBe(1001);
      expect(first.user).toBe('testuser');
      expect(first.title).toBe('Test Article');
      expect(first.points).toBe(42);
      expect(first.domain).toBe('example.com');
      expect(first.self).toBe(false);
      expect(first.comments_count).toBe(5);
      expect(first.time_ago).toContain('hour');
    });

    it('transforms Ask HN items with self=true', async () => {
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([1002]))
        .mockImplementationOnce(() => mockFetchResponse(sampleAskItem));

      const items = await new Promise<unknown[]>((resolve) => {
        data.getArticles((list) => resolve(list), true);
      });

      const item = items[0] as Record<string, unknown>;
      expect(item.self).toBe(true);
      expect(item.text).toBe('Seriously, what is it?');
      expect(item.domain).toBe('');
    });

    it('sets JOB for job type items', async () => {
      const jobItem: FirebaseItem = {
        id: 9999,
        by: 'hiring-co',
        title: 'We are hiring!',
        score: 1,
        time: Math.floor(Date.now() / 1000),
        type: 'job'
      };
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([9999]))
        .mockImplementationOnce(() => mockFetchResponse(jobItem));

      const items = await new Promise<unknown[]>((resolve) => {
        data.getArticles((list) => resolve(list), true);
      });

      expect((items[0] as Record<string, unknown>).points).toBe('JOB');
    });

    it('uses cached list on subsequent calls without reload', async () => {
      // First call fetches
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([1001]))
        .mockImplementationOnce(() => mockFetchResponse(sampleFirebaseItem));

      await new Promise<void>((resolve) => {
        data.getArticles(() => resolve(), true);
      });

      // Second call should use cache (no additional fetch)
      const callCountBefore = mockFetch.mock.calls.length;
      await new Promise<void>((resolve) => {
        data.getArticles(() => resolve());
      });

      expect(mockFetch.mock.calls.length).toBe(callCountBefore);
    });

    it('filters out null/deleted items', async () => {
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([1001, 9999]))
        .mockImplementationOnce(() => mockFetchResponse(sampleFirebaseItem))
        .mockImplementationOnce(() => mockFetchResponse(null)); // deleted/missing item

      const items = await new Promise<unknown[]>((resolve) => {
        data.getArticles((list) => resolve(list), true);
      });

      expect(items).toHaveLength(1);
    });
  });

  describe('getArticlesByType', () => {
    it('fetches from the correct endpoint for ask', async () => {
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([1002]))
        .mockImplementationOnce(() => mockFetchResponse(sampleAskItem));

      const items = await new Promise<unknown[]>((resolve) => {
        data.getArticlesByType('ask', (list) => resolve(list));
      });

      expect(items).toHaveLength(1);
      // Verify the URL was for ask stories
      expect(mockFetch.mock.calls[0][0]).toContain('/askstories.json');
    });

    it('fetches from the correct endpoint for show', async () => {
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([1002]))
        .mockImplementationOnce(() => mockFetchResponse(sampleAskItem));

      await new Promise<unknown[]>((resolve) => {
        data.getArticlesByType('show', (list) => resolve(list));
      });

      expect(mockFetch.mock.calls[0][0]).toContain('/showstories.json');
    });
  });

  describe('getArticleMeta', () => {
    it('fetches and transforms a single item', async () => {
      mockFetch.mockImplementationOnce(() => mockFetchResponse(sampleFirebaseItem));

      const item = await new Promise<unknown>((resolve) => {
        data.getArticleMeta(1001, (data) => resolve(data));
      });

      expect((item as Record<string, unknown>).id).toBe(1001);
      expect((item as Record<string, unknown>).user).toBe('testuser');
    });

    it('fetches from network when not in cache', async () => {
      const freshItem: FirebaseItem = {
        id: 9100,
        by: 'newuser',
        title: 'Fresh Article',
        score: 7,
        time: Math.floor(Date.now() / 1000),
        type: 'story'
      };
      mockFetch.mockImplementationOnce(() => mockFetchResponse(freshItem));

      const item = await new Promise<Record<string, unknown>>((resolve) => {
        data.getArticleMeta(9100, (d) => resolve(d as unknown as Record<string, unknown>));
      });

      expect(item.id).toBe(9100);
      expect(item.user).toBe('newuser');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('throws on fetch error', async () => {
      mockFetch.mockImplementationOnce(() => Promise.reject(new Error('fail')));

      await expect(
        new Promise<void>((_resolve, reject) => {
          data.getArticleMeta(9999, undefined).catch(reject);
        })
      ).rejects.toThrow();
    });
  });

  describe('getArticleComments', () => {
    it('fetches item via Algolia API and returns comment tree', async () => {
      // Algolia returns the full tree in one request
      const algoliaResponse = {
        id: 1001,
        type: 'story',
        author: 'testuser',
        title: 'Test Article',
        url: 'https://example.com/article',
        points: 42,
        created_at_i: Math.floor(Date.now() / 1000) - 3600,
        num_comments: null, // Algolia often returns null for num_comments
        children: [
          {
            id: 2001,
            type: 'comment',
            author: 'commenter',
            text: 'Great article!',
            created_at_i: Math.floor(Date.now() / 1000) - 1800,
            children: [
              {
                id: 2003,
                type: 'comment',
                author: 'replier',
                text: 'I agree!',
                created_at_i: Math.floor(Date.now() / 1000) - 900,
                children: []
              }
            ]
          },
          {
            id: 2002,
            type: 'comment',
            author: 'someone',
            text: 'Deleted comment',
            created_at_i: Math.floor(Date.now() / 1000),
            children: []
          }
        ]
      };

      mockFetch.mockReset();
      mockFetch.mockImplementationOnce(() => mockFetchResponse(algoliaResponse));

      const result = await new Promise<Record<string, unknown>>((resolve) => {
        data.getArticleComments(1001, (item) => resolve(item as unknown as Record<string, unknown>), true);
      });

      expect(result.id).toBe(1001);
      expect(Array.isArray(result.comments)).toBe(true);
      const comments = result.comments as Record<string, unknown>[];
      expect(comments).toHaveLength(2);
      expect(comments[0].id).toBe(2001);
      // 2001 has nested comment 2003
      const nested = comments[0].comments as Record<string, unknown>[];
      expect(nested).toHaveLength(1);
      expect(nested[0].id).toBe(2003);
    });

    it('handles Algolia response with empty children', async () => {
      const algoliaResponse = {
        id: 1001,
        type: 'story',
        author: 'testuser',
        title: 'Test Article',
        url: 'https://example.com/article',
        points: 42,
        created_at_i: Math.floor(Date.now() / 1000) - 3600,
        num_comments: 0,
        children: []
      };

      mockFetch.mockReset();
      mockFetch.mockImplementationOnce(() => mockFetchResponse(algoliaResponse));

      const result = await new Promise<Record<string, unknown>>((resolve) => {
        data.getArticleComments(1001, (item) => resolve(item as unknown as Record<string, unknown>), true);
      });

      const comments = result.comments as Record<string, unknown>[];
      expect(comments).toHaveLength(0);
    });

    it('marks article as visited in comments', async () => {
      const algoliaResponse = {
        id: 6001,
        type: 'story',
        author: 'author',
        title: 'Simple Post',
        points: 10,
        created_at_i: Math.floor(Date.now() / 1000),
        num_comments: 1,
        children: [
          {
            id: 2001,
            type: 'comment',
            author: 'commenter',
            text: 'Nice post',
            created_at_i: Math.floor(Date.now() / 1000),
            children: []
          }
        ]
      };

      mockFetch.mockReset();
      mockFetch.mockImplementationOnce(() => mockFetchResponse(algoliaResponse));

      await new Promise<Record<string, unknown>>((resolve) => {
        data.getArticleComments(6001, (item) => resolve(item as unknown as Record<string, unknown>), true);
      });

      const cached = data.cache().articles[6001];
      expect(cached).toBeDefined();
      expect(cached.commentsFetchTime).toBeDefined();
    });

    it('derives comments_count from children when num_comments is null', async () => {
      // Regression: Algolia API often returns num_comments as null
      const algoliaResponse = {
        id: 7001,
        type: 'story',
        author: 'author',
        title: 'Post With Comments',
        points: 15,
        created_at_i: Math.floor(Date.now() / 1000),
        num_comments: null,
        children: [
          {
            id: 7101,
            type: 'comment',
            author: 'c1',
            text: 'First comment',
            created_at_i: Math.floor(Date.now() / 1000),
            children: []
          },
          {
            id: 7102,
            type: 'comment',
            author: 'c2',
            text: 'Second comment',
            created_at_i: Math.floor(Date.now() / 1000),
            children: []
          }
        ]
      };

      mockFetch.mockReset();
      mockFetch.mockImplementationOnce(() => mockFetchResponse(algoliaResponse));

      const result = await new Promise<Record<string, unknown>>((resolve) => {
        data.getArticleComments(7001, (item) => resolve(item as unknown as Record<string, unknown>), true);
      });

      expect(result.comments_count).toBe(2);
    });

    it('returns 0 comments_count when Algolia children is empty', async () => {
      const algoliaResponse = {
        id: 7002,
        type: 'story',
        author: 'author',
        title: 'No Comments',
        points: 3,
        created_at_i: Math.floor(Date.now() / 1000),
        num_comments: null,
        children: []
      };

      mockFetch.mockReset();
      mockFetch.mockImplementationOnce(() => mockFetchResponse(algoliaResponse));

      const result = await new Promise<Record<string, unknown>>((resolve) => {
        data.getArticleComments(7002, (item) => resolve(item as unknown as Record<string, unknown>), true);
      });

      expect(result.comments_count).toBe(0);
    });
  });

  describe('error handling', () => {
    it('throws on fetch failure', async () => {
      mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

      await expect(
        new Promise<void>((_resolve, reject) => {
          data.getArticles(undefined, true).catch(reject);
        })
      ).rejects.toThrow();
    });

    it('throws on HTTP error status', async () => {
      mockFetch.mockImplementationOnce(() => mockFetchResponse(null, false));

      await expect(
        new Promise<void>((_resolve, reject) => {
          data.getArticles(undefined, true).catch(reject);
        })
      ).rejects.toThrow();
    });

    it('throws when getArticleComments fetch fails', async () => {
      mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

      await expect(
        new Promise<void>((_resolve, reject) => {
          data.getArticleComments(7777, undefined, true).catch(reject);
        })
      ).rejects.toThrow();
    });
  });

  describe('transform', () => {
    it('extracts domain from URL', async () => {
      const item: FirebaseItem = {
        id: 5001,
        by: 'user',
        title: 'Link',
        url: 'https://www.github.com/repo',
        score: 5,
        time: Math.floor(Date.now() / 1000),
        type: 'story'
      };
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([5001]))
        .mockImplementationOnce(() => mockFetchResponse(item));

      const items = await new Promise<Record<string, unknown>[]>((resolve) => {
        data.getArticles((list) => resolve(list as unknown as Record<string, unknown>[]), true);
      });

      expect(items[0].domain).toBe('github.com');
    });

    it('handles items with no URL as self posts', async () => {
      const selfPost: FirebaseItem = {
        id: 5002,
        by: 'user',
        title: 'My self post',
        text: 'Content here',
        score: 3,
        time: Math.floor(Date.now() / 1000),
        type: 'story'
      };
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([5002]))
        .mockImplementationOnce(() => mockFetchResponse(selfPost));

      const items = await new Promise<Record<string, unknown>[]>((resolve) => {
        data.getArticles((list) => resolve(list as unknown as Record<string, unknown>[]), true);
      });

      expect(items[0].self).toBe(true);
      expect(items[0].domain).toBe('');
    });

    it('computes time_ago from unix timestamp', async () => {
      const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
      const item: FirebaseItem = {
        id: 5003,
        by: 'user',
        title: 'Old post',
        score: 1,
        time: twoHoursAgo,
        type: 'story'
      };
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([5003]))
        .mockImplementationOnce(() => mockFetchResponse(item));

      const items = await new Promise<Record<string, unknown>[]>((resolve) => {
        data.getArticles((list) => resolve(list as unknown as Record<string, unknown>[]), true);
      });

      expect(items[0].time_ago).toContain('hour');
    });

    it('handles deleted items gracefully', async () => {
      const deleted: FirebaseItem = { id: 5004, deleted: true, type: 'story' };
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([5004]))
        .mockImplementationOnce(() => mockFetchResponse(deleted));

      const items = await new Promise<Record<string, unknown>[]>((resolve) => {
        data.getArticles((list) => resolve(list as unknown as Record<string, unknown>[]), true);
      });

      // Deleted items still get transformed but with [deleted] title
      expect(items[0].title).toBe('[deleted]');
    });
  });

  describe('loadMore', () => {
    it('does nothing when no pending IDs', async () => {
      const callCountBefore = mockFetch.mock.calls.length;
      await data.loadMore();
      expect(mockFetch.mock.calls.length).toBe(callCountBefore);
    });

    it('fetches next page of items', async () => {
      // First, load initial page with more IDs pending
      const ids = Array.from({ length: 35 }, (_, i) => 7000 + i);
      const items = ids.map(id => ({
        id,
        by: 'user',
        title: `Item ${id}`,
        score: 1,
        time: Math.floor(Date.now() / 1000),
        type: 'story'
      }));

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('topstories')) return mockFetchResponse(ids);
        const id = parseInt(url.match(/item\/(\d+)/)?.[1] || '0');
        return mockFetchResponse(items.find(i => i.id === id) || null);
      });

      await new Promise<void>((resolve) => {
        data.getArticles(() => resolve(), true);
      });

      // Now load more — should fetch the remaining 5 items
      const fetchCountBefore = mockFetch.mock.calls.length;
      await new Promise<void>((resolve) => {
        data.loadMore(() => resolve());
      });

      // Should have fetched 5 more items (IDs 7030-7034)
      expect(mockFetch.mock.calls.length).toBe(fetchCountBefore + 5);
    });
  });

  describe('getLocalData', () => {
    it('returns the local data cache', () => {
      const localData = data.cache();
      expect(localData).toBeDefined();
      expect(localData.articles).toBeDefined();
    });
  });

  describe('getArticleById', () => {
    it('returns cached article after getArticles loads', async () => {
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([1001]))
        .mockImplementationOnce(() => mockFetchResponse(sampleFirebaseItem));

      await new Promise<void>((resolve) => {
        data.getArticles(() => resolve(), true);
      });

      const cached = data.getArticleById(1001);
      expect(cached).toBeDefined();
      expect(cached?.id).toBe(1001);
      expect(cached?.title).toBe('Test Article');
    });

    it('returns undefined for unknown article id', () => {
      const cached = data.getArticleById(99999);
      expect(cached).toBeUndefined();
    });
  });

  describe('cache hit paths', () => {
    it('uses cached comments on second call without reload', async () => {
      const item: FirebaseItem = {
        id: 9001,
        by: 'user',
        title: 'Cached Post',
        score: 5,
        time: Math.floor(Date.now() / 1000),
        type: 'story',
        kids: [9002]
      };
      const comment: FirebaseItem = {
        id: 9002,
        by: 'commenter',
        text: 'cached comment',
        time: Math.floor(Date.now() / 1000),
        type: 'comment',
        parent: 9001
      };

      mockFetch
        .mockImplementationOnce(() => mockFetchResponse(item))
        .mockImplementationOnce(() => mockFetchResponse(comment));

      // First call fetches from network
      await new Promise<void>((resolve) => {
        data.getArticleComments(9001, () => resolve(), true);
      });

      const fetchCountBefore = mockFetch.mock.calls.length;

      // Second call should use cache
      await new Promise<void>((resolve) => {
        data.getArticleComments(9001, () => resolve(), false);
      });

      // No new fetch calls
      expect(mockFetch.mock.calls.length).toBe(fetchCountBefore);
    });

    it('calls callback with cached articles on repeat getArticles call', async () => {
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([1001]))
        .mockImplementationOnce(() => mockFetchResponse(sampleFirebaseItem));

      // First call
      await new Promise<void>((resolve) => {
        data.getArticles(() => resolve(), true);
      });

      const fetchCountBefore = mockFetch.mock.calls.length;

      // Second call without reload — should use cache
      const items = await new Promise<unknown[]>((resolve) => {
        data.getArticles((list) => resolve(list));
      });

      expect(mockFetch.mock.calls.length).toBe(fetchCountBefore);
      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe('getArticlesByType edge cases', () => {
    it('handles unknown type gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await data.getArticlesByType('unknown');
      expect(consoleSpy).toHaveBeenCalledWith('Unknown story type: unknown');
      consoleSpy.mockRestore();
    });
  });

  describe('transform edge cases', () => {
    it('handles items with undefined by field', async () => {
      const noAuthor: FirebaseItem = {
        id: 8001,
        title: 'No Author',
        score: 1,
        time: Math.floor(Date.now() / 1000),
        type: 'story'
      };
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([8001]))
        .mockImplementationOnce(() => mockFetchResponse(noAuthor));

      const items = await new Promise<Record<string, unknown>[]>((resolve) => {
        data.getArticles((list) => resolve(list as unknown as Record<string, unknown>[]), true);
      });

      expect(items[0].user).toBe('');
    });

    it('handles items with undefined score', async () => {
      const noScore: FirebaseItem = {
        id: 8002,
        by: 'user',
        title: 'No Score',
        time: Math.floor(Date.now() / 1000),
        type: 'story'
      };
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([8002]))
        .mockImplementationOnce(() => mockFetchResponse(noScore));

      const items = await new Promise<Record<string, unknown>[]>((resolve) => {
        data.getArticles((list) => resolve(list as unknown as Record<string, unknown>[]), true);
      });

      expect(items[0].points).toBe(0);
    });

    it('handles items with undefined time', async () => {
      const noTime: FirebaseItem = {
        id: 8003,
        by: 'user',
        title: 'No Time',
        score: 1,
        type: 'story'
      };
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([8003]))
        .mockImplementationOnce(() => mockFetchResponse(noTime));

      const items = await new Promise<Record<string, unknown>[]>((resolve) => {
        data.getArticles((list) => resolve(list as unknown as Record<string, unknown>[]), true);
      });

      expect(items[0].time_ago).toBe('');
    });

    it('handles items with undefined title', async () => {
      const noTitle: FirebaseItem = {
        id: 8004,
        by: 'user',
        score: 1,
        time: Math.floor(Date.now() / 1000),
        type: 'story'
      };
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([8004]))
        .mockImplementationOnce(() => mockFetchResponse(noTitle));

      const items = await new Promise<Record<string, unknown>[]>((resolve) => {
        data.getArticles((list) => resolve(list as unknown as Record<string, unknown>[]), true);
      });

      expect(items[0].title).toBe('[deleted]');
    });

    it('handles comment with undefined text', async () => {
      const noText: FirebaseItem = {
        id: 8005,
        by: 'user',
        time: Math.floor(Date.now() / 1000),
        type: 'comment'
      };
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse([8005]))
        .mockImplementationOnce(() => mockFetchResponse(noText));

      const items = await new Promise<Record<string, unknown>[]>((resolve) => {
        data.getArticles((list) => resolve(list as unknown as Record<string, unknown>[]), true);
      });

      expect(items[0].text).toBeUndefined();
    });
  });
});
