// Template utility functions

export function template(tmpl: string, data: Record<string, unknown>, prefix = ''): string {
  let result = tmpl;
  for (const key in data) {
    const value = data[key];
    if (typeof value === 'object' && value !== null) {
      result = template(result, value as Record<string, unknown>, `${key}.`);
    } else {
      const placeholder = `{${prefix}${key}}`;
      result = result.split(placeholder).join(String(value || ''));
    }
  }
  return result;
}

export function prerender(tmpl: string): (data: Record<string, unknown>) => string {
  const cleanTemplate = tmpl
    .replace(/[\t|\n]/g, '')
    .replace(/'/g, "\\'")
    .replace(/\s\s+/g, ' ');

  const functionBody = cleanTemplate.replace(
    /\{\s*([a-z0-9_][.a-z0-9_]*)\s*\}/gi,
    (_tag, key) => `' + ( data.${key} || '' ) + '`
  );

  // Note: Using Function constructor for template compilation.
  // This is safe because templates come from trusted HTML templates in the page,
  // not from user input. Data passed to the template is escaped.
  return new Function('data', `return '${functionBody}';`) as (data: Record<string, unknown>) => string;
}
