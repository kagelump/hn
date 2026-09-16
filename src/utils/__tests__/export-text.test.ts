import { describe, expect, it } from 'vitest';
import { htmlToExportText } from '../export-text';

describe('htmlToExportText', () => {
  it('preserves paragraphs, quotes, code whitespace and link destinations', () => {
    const text = htmlToExportText('<p>One &amp; two</p><p>Next<br>line</p><blockquote>A quote</blockquote><pre><code>  x\n\n\n    y</code></pre><a href="/ref">Reference</a>', 'https://example.com/story');
    expect(text).toContain('One & two\n\n');
    expect(text).toContain('Next\nline');
    expect(text).toContain('> A quote');
    expect(text).toContain('```\n  x\n\n\n    y\n```');
    expect(text).toContain('[Reference](https://example.com/ref)');
  });

  it('omits executable content and unsafe link destinations', () => {
    expect(htmlToExportText('<script>secret()</script><style>css</style><a href="javascript:bad()">label</a>')).toBe('label');
  });
});
