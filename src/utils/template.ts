// Template utility functions

export function template(tmpl: string, data: Record<string, any>, prefix = ''): string {
  let result = tmpl;
  for (const key in data) {
    const value = data[key];
    if (typeof value === 'object' && value !== null) {
      result = template(result, value, `${key}.`);
    } else {
      const placeholder = `{${prefix}${key}}`;
      result = result.split(placeholder).join(String(value || ''));
    }
  }
  return result;
}

export function prerender(tmpl: string): (data: Record<string, any>) => string {
  const cleanTemplate = tmpl
    .replace(/[\t|\n]/g, '')
    .replace(/'/g, "\\'")
    .replace(/\s\s+/g, ' ');

  const functionBody = cleanTemplate.replace(
    /\{\s*([a-z0-9_][.a-z0-9_]*)\s*\}/gi,
    (_tag, key) => `' + ( data.${key} || '' ) + '`
  );

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function('data', `return '${functionBody}';`) as (data: Record<string, any>) => string;
}
