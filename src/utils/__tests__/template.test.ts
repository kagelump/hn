import { describe, it, expect } from 'vitest';
import { template, prerender, escapeHtml } from '../template';

describe('template', () => {
  it('replaces single placeholder', () => {
    expect(template('Hello {name}!', { name: 'World' })).toBe('Hello World!');
  });

  it('replaces multiple placeholders', () => {
    const result = template('{greeting} {name}!', { greeting: 'Hi', name: 'Mom' });
    expect(result).toBe('Hi Mom!');
  });

  it('leaves placeholder intact when key is missing from data', () => {
    expect(template('Hello {name}!', {})).toBe('Hello {name}!');
  });

  it('handles nested objects with dot notation', () => {
    const result = template('{user.name} is {user.age}', { user: { name: 'Alice', age: 30 } });
    expect(result).toBe('Alice is 30');
  });

  it('replaces multiple occurrences of the same placeholder', () => {
    expect(template('{x} and {x}', { x: 'yes' })).toBe('yes and yes');
  });

  it('handles numeric values', () => {
    expect(template('Count: {n}', { n: 42 })).toBe('Count: 42');
  });
});

describe('prerender', () => {
  it('returns a function', () => {
    const fn = prerender('<b>{title}</b>');
    expect(typeof fn).toBe('function');
  });

  it('compiles template into render function', () => {
    const render = prerender('<li>{title}</li>');
    expect(render({ title: 'Test' })).toBe('<li>Test</li>');
  });

  it('handles multiple placeholders', () => {
    const render = prerender('<span>{user}</span><span>{time_ago}</span>');
    expect(render({ user: 'alice', time_ago: '5 mins' })).toBe('<span>alice</span><span>5 mins</span>');
  });

  it('handles empty values gracefully', () => {
    const render = prerender('<b>{title}</b>');
    expect(render({})).toBe("<b></b>");
  });
});

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toContain('&lt;');
    expect(escapeHtml('<script>alert("xss")</script>')).toContain('&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toContain('&amp;');
  });

  it('does not alter quotes (jsdom only escapes <, >, &)', () => {
    // div.textContent escaping only handles <, >, and &
    expect(escapeHtml('"hello"')).toBe('"hello"');
  });

  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});
