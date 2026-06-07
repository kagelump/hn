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
import { data, extractHnPageData, sortCommentsByPageOrder, applyColorClasses } from '../data';
import type { HNComment } from '../../types';

function mockFetchResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body))
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

  describe('extractHnPageData', () => {
    const storyId = 48432199;

    it('extracts comment IDs in page order from HN HTML', () => {
      // tr elements must be inside a table for DOMParser to preserve them
      const html = `<table>
        <tr class="athing" id="48432199"></tr>
        <tr class="athing comtr" id="48432429"></tr>
        <tr class="athing comtr" id="48433055"></tr>
        <tr class="athing comtr" id="48432748"></tr>
      </table>`;
      const result = extractHnPageData(html, storyId);
      expect(result.orderedIds).toEqual([48432429, 48433055, 48432748]);
    });

    it('filters out the story row itself', () => {
      const html = `<table>
        <tr class="athing" id="48432199"></tr>
        <tr class="athing comtr" id="48432429"></tr>
      </table>`;
      const result = extractHnPageData(html, storyId);
      expect(result.orderedIds).not.toContain(storyId);
      expect(result.orderedIds).toEqual([48432429]);
    });

    it('extracts color classes from commtext divs', () => {
      const html = `<table>
        <tr class="athing" id="48432199"></tr>
        <tr class="athing comtr" id="48432429">
          <td><div class="commtext c00">normal comment</div></td>
        </tr>
        <tr class="athing comtr" id="48433055">
          <td><div class="commtext c88">downvoted</div></td>
        </tr>
        <tr class="athing comtr" id="48432748">
          <td><div class="commtext c5A">slightly downvoted</div></td>
        </tr>
      </table>`;
      const result = extractHnPageData(html, storyId);
      expect(result.colorClasses.get(48432429)).toBe('c00');
      expect(result.colorClasses.get(48433055)).toBe('c88');
      expect(result.colorClasses.get(48432748)).toBe('c5A');
    });

    it('collects order and colors from deeply nested HN table structure', () => {
      // Real HN comment structure: tr > td > table > tbody > tr > td > div.comment > div.commtext
      const html = `<table>
        <tr class="athing" id="48432199"></tr>
        <tr class="athing comtr" id="48434420">
          <td>
            <table>
              <tbody>
                <tr>
                  <td class="ind"><img width="0"></td>
                  <td class="default">
                    <div class="comment">
                      <span class="comhead">user 1 hour ago</span>
                      <div class="commtext c00">normal</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
        <tr class="athing comtr" id="48434573">
          <td>
            <table>
              <tbody>
                <tr>
                  <td class="ind"><img width="40"></td>
                  <td class="default">
                    <div class="comment">
                      <div class="commtext c5A">downvoted</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </table>`;
      const result = extractHnPageData(html, storyId);
      expect(result.orderedIds).toEqual([48434420, 48434573]);
      expect(result.colorClasses.get(48434420)).toBe('c00');
      expect(result.colorClasses.get(48434573)).toBe('c5A');
    });

    it('handles comments without commtext div gracefully', () => {
      const html = `<table>
        <tr class="athing comtr" id="48432429"><td>no commtext here</td></tr>
      </table>`;
      const result = extractHnPageData(html, storyId);
      expect(result.orderedIds).toEqual([48432429]);
      expect(result.colorClasses.has(48432429)).toBe(false);
    });

    it('handles empty HTML gracefully', () => {
      const result = extractHnPageData('', storyId);
      expect(result.orderedIds).toEqual([]);
      expect(result.colorClasses.size).toBe(0);
    });

    it('falls back to regex extraction when HTML has no table wrapper', () => {
      // Bare tr elements (no <table>) get dropped by DOMParser — regex fallback catches them
      const html = 'garbage <tr class="athing" id="48432429"><td>broken';
      const result = extractHnPageData(html, storyId);
      expect(result.orderedIds).toContain(48432429);
    });
  });

  describe('sortCommentsByPageOrder', () => {
    function makeComment(id: number, children?: HNComment[]): HNComment {
      return { id, user: 'u', time_ago: '1h', content: '', comments: children };
    }

    it('sorts top-level comments by page order', () => {
      const comments = [
        makeComment(3),
        makeComment(1),
        makeComment(2),
      ];
      const order = [1, 2, 3];
      const sorted = sortCommentsByPageOrder(comments, order);
      expect(sorted.map(c => c.id)).toEqual([1, 2, 3]);
    });

    it('recursively sorts nested comments', () => {
      const comments = [
        makeComment(1, [
          makeComment(13),
          makeComment(11),
          makeComment(12),
        ]),
        makeComment(2),
      ];
      const order = [1, 11, 12, 13, 2];
      const sorted = sortCommentsByPageOrder(comments, order);
      expect(sorted[0].id).toBe(1);
      expect(sorted[0].comments!.map(c => c.id)).toEqual([11, 12, 13]);
      expect(sorted[1].id).toBe(2);
    });

    it('places comments not in orderedIds at the end, preserving original relative order', () => {
      const comments = [
        makeComment(3),
        makeComment(1),
        makeComment(2),
      ];
      const order = [2]; // only 2 is in the order
      const sorted = sortCommentsByPageOrder(comments, order);
      // 2 comes first (in order), then 3 and 1 in original Algolia order (stable sort)
      expect(sorted.map(c => c.id)).toEqual([2, 3, 1]);
    });

    it('returns empty array when given empty comments', () => {
      const sorted = sortCommentsByPageOrder([], [1, 2, 3]);
      expect(sorted).toEqual([]);
    });

    it('preserves comment properties beyond id', () => {
      const comments: HNComment[] = [
        { id: 2, user: 'b', time_ago: '2h', content: 'second' },
        { id: 1, user: 'a', time_ago: '1h', content: 'first' },
      ];
      const sorted = sortCommentsByPageOrder(comments, [1, 2]);
      expect(sorted[0].user).toBe('a');
      expect(sorted[0].content).toBe('first');
      expect(sorted[1].user).toBe('b');
      expect(sorted[1].content).toBe('second');
    });

    it('does not mutate the original comments array', () => {
      const comments = [makeComment(2), makeComment(1)];
      const sorted = sortCommentsByPageOrder(comments, [1, 2]);
      expect(comments[0].id).toBe(2); // original unchanged
      expect(sorted[0].id).toBe(1);
    });
  });

  describe('applyColorClasses', () => {
    function makeComment(id: number, children?: HNComment[]): HNComment {
      return { id, user: 'u', time_ago: '1h', content: '', comments: children };
    }

    it('applies color class to matching comments', () => {
      const comments = [
        makeComment(1),
        makeComment(2),
      ];
      const colorClasses = new Map<number, string>([
        [1, 'c88'],
        [2, 'c5A'],
      ]);
      applyColorClasses(comments, colorClasses);
      expect(comments[0].colorClass).toBe('c88');
      expect(comments[1].colorClass).toBe('c5A');
    });

    it('skips c00 since it is the default black', () => {
      const comments = [makeComment(1)];
      const colorClasses = new Map<number, string>([[1, 'c00']]);
      applyColorClasses(comments, colorClasses);
      expect(comments[0].colorClass).toBeUndefined();
    });

    it('applies color classes recursively to nested comments', () => {
      const comments = [
        makeComment(1, [
          makeComment(11),
          makeComment(12),
        ]),
      ];
      const colorClasses = new Map<number, string>([
        [11, 'cAE'],
        [12, 'cDD'],
      ]);
      applyColorClasses(comments, colorClasses);
      expect(comments[0].comments![0].colorClass).toBe('cAE');
      expect(comments[0].comments![1].colorClass).toBe('cDD');
    });

    it('leaves comments not in the map unchanged', () => {
      const comments = [makeComment(1)];
      applyColorClasses(comments, new Map());
      expect(comments[0].colorClass).toBeUndefined();
    });

    it('handles deeply nested trees', () => {
      const comments = [
        makeComment(1, [
          makeComment(2, [
            makeComment(3),
          ]),
        ]),
      ];
      const colorClasses = new Map<number, string>([[3, 'c88']]);
      applyColorClasses(comments, colorClasses);
      expect(comments[0].comments![0].comments![0].colorClass).toBe('c88');
    });
  });

  describe('getArticleComments with HN page ordering', () => {
    it('sets sortWarning when HN page fetch fails', async () => {
      const algoliaResponse = {
        id: 5001,
        type: 'story',
        author: 'author',
        title: 'Test',
        points: 10,
        created_at_i: Math.floor(Date.now() / 1000),
        children: [
          {
            id: 6001,
            type: 'comment',
            author: 'c1',
            text: 'Comment 1',
            created_at_i: Math.floor(Date.now() / 1000),
            children: []
          }
        ]
      };

      // First call: Algolia succeeds. Second call: HN page fails.
      mockFetch.mockReset();
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse(algoliaResponse))
        .mockImplementationOnce(() => Promise.reject(new Error('CORS proxy down')));

      const result = await new Promise<Record<string, unknown>>((resolve) => {
        data.getArticleComments(5001, (item) => resolve(item as unknown as Record<string, unknown>), true);
      });

      expect(result.sortWarning).toBeDefined();
      expect(result.sortWarning).toContain('Could not fetch the HN page');
    });

    it('sorts comments by HN page order and applies color classes when fetch succeeds', async () => {
      const algoliaResponse = {
        id: 5002,
        type: 'story',
        author: 'author',
        title: 'Sort Test',
        points: 10,
        created_at_i: Math.floor(Date.now() / 1000),
        children: [
          {
            id: 6003,
            type: 'comment',
            author: 'c3',
            text: 'Third',
            created_at_i: Math.floor(Date.now() / 1000),
            children: []
          },
          {
            id: 6001,
            type: 'comment',
            author: 'c1',
            text: 'First',
            created_at_i: Math.floor(Date.now() / 1000),
            children: []
          },
          {
            id: 6002,
            type: 'comment',
            author: 'c2',
            text: 'Second',
            created_at_i: Math.floor(Date.now() / 1000),
            children: []
          }
        ]
      };

      // HN page HTML with comments in order: 6001, 6002, 6003
      // 6003 has c88 (downvoted)
      const hnHtml = `<table>
        <tr class="athing" id="5002"></tr>
        <tr class="athing comtr" id="6001"><td><div class="commtext c00">First</div></td></tr>
        <tr class="athing comtr" id="6002"><td><div class="commtext c00">Second</div></td></tr>
        <tr class="athing comtr" id="6003"><td><div class="commtext c88">Third</div></td></tr>
      </table>`;

      mockFetch.mockReset();
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse(algoliaResponse))
        .mockImplementationOnce(() => mockFetchResponse(hnHtml));

      const result = await new Promise<Record<string, unknown>>((resolve) => {
        data.getArticleComments(5002, (item) => resolve(item as unknown as Record<string, unknown>), true);
      });

      const comments = result.comments as Record<string, unknown>[];
      expect(comments).toHaveLength(3);
      expect(comments[0].id).toBe(6001);
      expect(comments[1].id).toBe(6002);
      expect(comments[2].id).toBe(6003);

      // Downvoted comment gets color class
      expect(comments[2].colorClass).toBe('c88');

      // Healthy comments don't get c00 attached
      expect(comments[0].colorClass).toBeUndefined();

      // No warning when everything succeeds
      expect(result.sortWarning).toBeUndefined();
    });

    it('sorts nested comments correctly from page order', async () => {
      const algoliaResponse = {
        id: 5003,
        type: 'story',
        author: 'author',
        title: 'Nested Test',
        points: 5,
        created_at_i: Math.floor(Date.now() / 1000),
        children: [
          {
            id: 7001,
            type: 'comment',
            author: 'parent',
            text: 'Parent',
            created_at_i: Math.floor(Date.now() / 1000),
            children: [
              {
                id: 7003,
                type: 'comment',
                author: 'reply2',
                text: 'Second reply',
                created_at_i: Math.floor(Date.now() / 1000),
                children: []
              },
              {
                id: 7002,
                type: 'comment',
                author: 'reply1',
                text: 'First reply',
                created_at_i: Math.floor(Date.now() / 1000),
                children: []
              }
            ]
          }
        ]
      };

      // Page order: parent, then replies in correct order
      const hnHtml = `<table>
        <tr class="athing" id="5003"></tr>
        <tr class="athing comtr" id="7001"><td><div class="commtext c00">Parent</div></td></tr>
        <tr class="athing comtr" id="7002"><td><div class="commtext c00">Reply 1</div></td></tr>
        <tr class="athing comtr" id="7003"><td><div class="commtext c00">Reply 2</div></td></tr>
      </table>`;

      mockFetch.mockReset();
      mockFetch
        .mockImplementationOnce(() => mockFetchResponse(algoliaResponse))
        .mockImplementationOnce(() => mockFetchResponse(hnHtml));

      const result = await new Promise<Record<string, unknown>>((resolve) => {
        data.getArticleComments(5003, (item) => resolve(item as unknown as Record<string, unknown>), true);
      });

      const comments = result.comments as Record<string, unknown>[];
      expect(comments).toHaveLength(1);
      const replies = comments[0].comments as Record<string, unknown>[];
      expect(replies).toHaveLength(2);
      expect(replies[0].id).toBe(7002);
      expect(replies[1].id).toBe(7003);
    });
  });
});
