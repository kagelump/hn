/** Convert article/comment HTML into readable text without losing links or blocks. */
export function htmlToExportText(html: string, baseUrl = 'https://news.ycombinator.com/'): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  function render(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').replace(/\s+/g, ' ');
    if (!(node instanceof Element)) return '';
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'iframe'].includes(tag)) return '';
    if (tag === 'pre') {
      const content = node.textContent || '';
      const fence = '`'.repeat(Math.max(3, ...Array.from(content.matchAll(/`+/g), m => m[0].length + 1)));
      return `\n\n${fence}\n${content}\n${fence}\n\n`;
    }
    const text = Array.from(node.childNodes).map(render).join('');
    if (tag === 'br') return '\n';
    if (tag === 'a') {
      try {
        const url = new URL(node.getAttribute('href') || '', baseUrl);
        if (['https:', 'http:', 'mailto:'].includes(url.protocol)) {
          return text === url.href ? text : `[${text || url.href}](${url.href})`;
        }
      } catch { /* Keep the label when a URL cannot be resolved. */ }
      return text;
    }
    if (tag === 'blockquote') return `\n\n${text.trim().split('\n').map(line => `> ${line}`).join('\n')}\n\n`;
    if (tag === 'li') return `\n- ${text.trim()}\n`;
    if (tag === 'tr') return `\n${text}\n`;
    if (tag === 'td' || tag === 'th') return `${text}\t`;
    if (/^(p|div|section|article|h[1-6]|ul|ol)$/.test(tag)) return `\n\n${text.trim()}\n\n`;
    return text;
  }
  return Array.from(doc.body.childNodes).map(render).join('').trim();
}
