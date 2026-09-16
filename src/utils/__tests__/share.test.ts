import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shareTextFile } from '../share';

describe('shareTextFile', () => {
  const share = vi.fn();
  const canShare = vi.fn();

  beforeEach(() => {
    share.mockReset().mockResolvedValue(undefined);
    canShare.mockReset().mockReturnValue(true);
    vi.stubGlobal('navigator', { share, canShare });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shares all long Unicode content in a text attachment with no inline text or URL', async () => {
    const text = 'Summarize this article:\nhttps://example.com\n' + '漢字 📰\n'.repeat(50_000);
    await shareTextFile('Title / with : punctuation', text, 'article');
    const payload = share.mock.calls[0][0];
    expect(Object.keys(payload)).toEqual(['files']);
    const file = payload.files[0] as File;
    expect(file.name).toBe('Title - with - punctuation-article.txt');
    expect(file.type).toBe('text/plain');
    const result = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
    expect(result).toBe(text);
  });

  it('uses a fallback name for untitled discussions', async () => {
    await shareTextFile('', 'Comments', 'discussion');
    expect(share.mock.calls[0][0].files[0].name).toBe('Hacker News-discussion.txt');
  });

  it('silently handles cancellation', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    share.mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    await shareTextFile('Title', 'Body', 'article');
    expect(alert).not.toHaveBeenCalled();
  });

  it('shows sharing failures instead of silently losing the action', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    share.mockRejectedValue(new Error('Failed'));
    await shareTextFile('Title', 'Body', 'article');
    expect(alert).toHaveBeenCalledWith('Could not share the attachment. Please try again.');
  });

  it('downloads a file when attachment sharing is unsupported', async () => {
    vi.useFakeTimers();
    canShare.mockReturnValue(false);
    const createObjectURL = vi.fn(() => 'blob:attachment');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('Title-discussion.txt');
      expect(this.href).toBe('blob:attachment');
      expect(this.isConnected).toBe(true);
    });
    await shareTextFile('Title', 'Comments', 'discussion');
    expect(share).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:attachment');
  });
});
