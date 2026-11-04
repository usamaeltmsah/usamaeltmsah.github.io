import { describe, expect, it } from 'vitest';
import { injectEntry } from '../scripts/lazy-entry';

describe('injectEntry', () => {
  const P = '/__ENTRY__';

  it('fills in every placeholder', () => {
    expect(injectEntry(`<div data-entry="${P}"></div><a href="${P}">`, P, '/_astro/x.abc.js'))
      .toBe('<div data-entry="/_astro/x.abc.js"></div><a href="/_astro/x.abc.js">');
  });

  it('returns null for pages that do not use it, so they are left untouched', () => {
    expect(injectEntry('<p>no loader here</p>', P, '/_astro/x.js')).toBeNull();
  });

  it('treats the placeholder literally, not as a pattern', () => {
    expect(injectEntry('a.b a-b', 'a.b', 'X')).toBe('X a-b');
  });
});
