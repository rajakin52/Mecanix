import { describe, it, expect } from 'vitest';
import { sanitizeSearch } from './sanitize';

describe('sanitizeSearch', () => {
  it('passes plain alphanumeric through', () => {
    expect(sanitizeSearch('toyota avanza')).toBe('toyota avanza');
  });

  it('strips PostgREST .or() operators', () => {
    // Comma, period, parens, quotes, backslash would all break or inject
    // into a PostgREST .or() filter.
    expect(sanitizeSearch('a,b.c(d)e"f\'g\\h')).toBe('abcdefgh');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeSearch('  spaced  ')).toBe('spaced');
  });

  it('keeps accents and diacritics', () => {
    expect(sanitizeSearch('João Pêssoa')).toBe('João Pêssoa');
  });

  it('preserves dashes and other safe chars', () => {
    expect(sanitizeSearch('LD-2188-HR')).toBe('LD-2188-HR');
  });

  it('handles empty string', () => {
    expect(sanitizeSearch('')).toBe('');
  });
});
