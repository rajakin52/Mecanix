import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encrypt, decrypt, isEncrypted } from './encryption';

// Encryption reads ENCRYPTION_KEY from the environment at call time, so
// set it up for the test run and restore after.
const ORIGINAL_KEY = process.env['ENCRYPTION_KEY'];
const TEST_KEY = '0'.repeat(64); // 32 bytes of hex

beforeAll(() => {
  process.env['ENCRYPTION_KEY'] = TEST_KEY;
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env['ENCRYPTION_KEY'];
  else process.env['ENCRYPTION_KEY'] = ORIGINAL_KEY;
});

describe('encrypt / decrypt', () => {
  it('round-trips a plaintext', () => {
    const plaintext = 'super-secret-erp-password';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces a different ciphertext every call (random IV)', () => {
    const plaintext = 'same input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it('handles empty string', () => {
    const ciphertext = encrypt('');
    expect(decrypt(ciphertext)).toBe('');
  });

  it('handles unicode', () => {
    const plaintext = 'Ângelo ção 中文 🔐';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('throws on tampered ciphertext', () => {
    const ciphertext = encrypt('real');
    // Flip the last byte to break the auth tag / ciphertext
    const buf = Buffer.from(ciphertext, 'base64');
    buf[buf.length - 1] = (buf[buf.length - 1]! ^ 0xff) & 0xff;
    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('refuses to run without ENCRYPTION_KEY', () => {
    const saved = process.env['ENCRYPTION_KEY'];
    delete process.env['ENCRYPTION_KEY'];
    try {
      expect(() => encrypt('anything')).toThrow(/ENCRYPTION_KEY/);
    } finally {
      process.env['ENCRYPTION_KEY'] = saved;
    }
  });
});

describe('isEncrypted', () => {
  it('returns true for values produced by encrypt()', () => {
    expect(isEncrypted(encrypt('anything'))).toBe(true);
  });

  it('returns false for plain passwords', () => {
    expect(isEncrypted('hunter2')).toBe(false);
    expect(isEncrypted('password123')).toBe(false);
  });

  it('returns false for empty / short strings', () => {
    expect(isEncrypted('')).toBe(false);
    expect(isEncrypted('short')).toBe(false);
  });
});
