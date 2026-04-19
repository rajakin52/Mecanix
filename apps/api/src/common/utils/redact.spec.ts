import { describe, it, expect } from 'vitest';
import { redactPhone, redactEmail, redactName } from './redact';

describe('redactPhone', () => {
  it('keeps country prefix and last 4 digits', () => {
    // 12 digits: leadLen = 12-4-3 = 5, so 5 leading digits + *** + 4 tail
    expect(redactPhone('+244923456789')).toBe('+24492***6789');
  });

  it('masks Angolan mobile without +', () => {
    // 9 digits: leadLen = 9-4-3 = 2
    expect(redactPhone('923456789')).toBe('+92***6789');
  });

  it('handles null / undefined / empty', () => {
    expect(redactPhone(null)).toBe('(none)');
    expect(redactPhone(undefined)).toBe('(none)');
    expect(redactPhone('')).toBe('(none)');
  });

  it('collapses very short numbers', () => {
    expect(redactPhone('1234')).toBe('***');
    expect(redactPhone('12')).toBe('***');
  });

  it('strips non-digit characters before masking', () => {
    expect(redactPhone('+244 923 456 789')).toBe('+24492***6789');
    expect(redactPhone('(244) 923-456-789')).toBe('+24492***6789');
  });
});

describe('redactEmail', () => {
  it('keeps first initial + domain', () => {
    expect(redactEmail('john.doe@example.com')).toBe('j***@example.com');
  });

  it('handles single-character local part', () => {
    expect(redactEmail('a@example.com')).toBe('a***@example.com');
  });

  it('returns *** for malformed emails', () => {
    expect(redactEmail('@example.com')).toBe('***');
    expect(redactEmail('no-at-sign')).toBe('***');
  });

  it('handles null / undefined / empty', () => {
    expect(redactEmail(null)).toBe('(none)');
    expect(redactEmail(undefined)).toBe('(none)');
    expect(redactEmail('')).toBe('(none)');
  });
});

describe('redactName', () => {
  it('keeps initial + char length', () => {
    expect(redactName('João Silva')).toBe('J. (10ch)');
    expect(redactName('alice')).toBe('A. (5ch)');
  });

  it('trims whitespace before taking the initial', () => {
    expect(redactName('  Bob ')).toBe('B. (6ch)');
  });

  it('handles null / undefined / empty', () => {
    expect(redactName(null)).toBe('(none)');
    expect(redactName(undefined)).toBe('(none)');
    expect(redactName('')).toBe('(none)');
  });
});
