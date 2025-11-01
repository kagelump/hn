// Template utility functions

// Escape HTML special characters to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function template(tmpl: string, data: Record<string, unknown>, prefix = ''): string {
  let result = tmpl;
  for (const key in data) {
    const value = data[key];
    if (typeof value === 'object' && value !== null) {
      result = template(result, value as Record<string, unknown>, `${key}.`);
    } else {
      const placeholder = `{${prefix}${key}}`;
      const stringValue = String(value || '');
      result = result.split(placeholder).join(stringValue);
    }
  }
  return result;
}

export function prerender(tmpl: string): (data: Record<string, unknown>) => string {
  const cleanTemplate = tmpl
    .replace(/[\t|\n]/g, '')
    // Properly escape single quotes and backslashes
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\s\s+/g, ' ');

  const functionBody = cleanTemplate.replace(
    /\{\s*([a-z0-9_][.a-z0-9_]*)\s*\}/gi,
    (_tag, key) => `' + ( data.${key} || '' ) + '`
  );

  // Note: Using Function constructor for template compilation.
  // This is safe because templates come from trusted HTML templates in the page,
  // not from user input. Data passed to the template is escaped when needed.
  // For user-generated content, use escapeHtml() before passing to template.
  return new Function('data', `return '${functionBody}';`) as (data: Record<string, unknown>) => string;
}

export { escapeHtml };
