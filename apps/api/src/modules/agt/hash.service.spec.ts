import { describe, it, expect, beforeAll } from 'vitest';
import { HashService } from './hash.service';

// AGT hash chain uses RSA-SHA1 signatures. Generating a key pair per
// test would be slow (~100ms each), so we generate one pair for the
// whole suite.
let service: HashService;
let publicKey: string;
let privateKey: string;

beforeAll(() => {
  service = new HashService();
  const keys = service.generateTestKeyPair();
  publicKey = keys.publicKey;
  privateKey = keys.privateKey;
});

describe('HashService.generateHash / verifyHash', () => {
  const sample = {
    invoiceDate: '2026-04-19',
    systemEntryDate: '2026-04-19T15:30:00',
    documentNumber: 'FT MECANIX/1',
    grossTotal: 1710.50,
    previousHash: '',
  };

  it('generates a non-empty base64 signature', () => {
    const hash = service.generateHash(
      sample.invoiceDate,
      sample.systemEntryDate,
      sample.documentNumber,
      sample.grossTotal,
      sample.previousHash,
      privateKey,
    );
    expect(hash).toBeTruthy();
    expect(hash.length).toBeGreaterThan(100); // 2048-bit RSA base64 is ~344 chars
    expect(hash).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('verifies its own signature', () => {
    const hash = service.generateHash(
      sample.invoiceDate,
      sample.systemEntryDate,
      sample.documentNumber,
      sample.grossTotal,
      sample.previousHash,
      privateKey,
    );

    const valid = service.verifyHash(
      sample.invoiceDate,
      sample.systemEntryDate,
      sample.documentNumber,
      sample.grossTotal,
      sample.previousHash,
      hash,
      publicKey,
    );
    expect(valid).toBe(true);
  });

  it('fails verification when any input field changes', () => {
    const hash = service.generateHash(
      sample.invoiceDate,
      sample.systemEntryDate,
      sample.documentNumber,
      sample.grossTotal,
      sample.previousHash,
      privateKey,
    );

    // Tamper: invoiceDate different
    const valid1 = service.verifyHash(
      '2026-04-20',
      sample.systemEntryDate,
      sample.documentNumber,
      sample.grossTotal,
      sample.previousHash,
      hash,
      publicKey,
    );
    expect(valid1).toBe(false);

    // Tamper: grossTotal different by 1 cent
    const valid2 = service.verifyHash(
      sample.invoiceDate,
      sample.systemEntryDate,
      sample.documentNumber,
      1710.51,
      sample.previousHash,
      hash,
      publicKey,
    );
    expect(valid2).toBe(false);
  });

  it('produces deterministic output for same input (RSA-SHA1 uses PKCS1 v1.5 padding)', () => {
    const a = service.generateHash(
      sample.invoiceDate,
      sample.systemEntryDate,
      sample.documentNumber,
      sample.grossTotal,
      sample.previousHash,
      privateKey,
    );
    const b = service.generateHash(
      sample.invoiceDate,
      sample.systemEntryDate,
      sample.documentNumber,
      sample.grossTotal,
      sample.previousHash,
      privateKey,
    );
    // Node's crypto.sign with RSA uses deterministic PKCS#1 v1.5 padding by default
    expect(a).toBe(b);
  });

  it('chains: previous hash changes the signature', () => {
    const first = service.generateHash(
      sample.invoiceDate,
      sample.systemEntryDate,
      sample.documentNumber,
      sample.grossTotal,
      '',
      privateKey,
    );
    const next = service.generateHash(
      sample.invoiceDate,
      sample.systemEntryDate,
      'FT MECANIX/2',
      sample.grossTotal,
      first, // chain
      privateKey,
    );
    expect(first).not.toBe(next);
  });

  it('formats grossTotal to 2 decimals — same hash for 1710 vs 1710.00', () => {
    const a = service.generateHash(
      sample.invoiceDate,
      sample.systemEntryDate,
      sample.documentNumber,
      1710,
      sample.previousHash,
      privateKey,
    );
    const b = service.generateHash(
      sample.invoiceDate,
      sample.systemEntryDate,
      sample.documentNumber,
      1710.00,
      sample.previousHash,
      privateKey,
    );
    expect(a).toBe(b);
  });

  it('invalid signature returns false, no throw', () => {
    const fake = Buffer.from('not a real signature').toString('base64');
    expect(
      service.verifyHash(
        sample.invoiceDate,
        sample.systemEntryDate,
        sample.documentNumber,
        sample.grossTotal,
        sample.previousHash,
        fake,
        publicKey,
      ),
    ).toBe(false);
  });
});

describe('HashService.shortHash', () => {
  it('returns the first 4 characters', () => {
    expect(service.shortHash('ABCDEFGHIJKLMNO')).toBe('ABCD');
  });

  it('handles short inputs', () => {
    expect(service.shortHash('AB')).toBe('AB');
    expect(service.shortHash('')).toBe('');
  });
});

describe('HashService.generateTestKeyPair', () => {
  it('produces a working PEM key pair', () => {
    const keys = service.generateTestKeyPair();
    expect(keys.publicKey).toMatch(/-----BEGIN PUBLIC KEY-----/);
    expect(keys.privateKey).toMatch(/-----BEGIN PRIVATE KEY-----/);

    // Round-trip with the new keys
    const hash = service.generateHash(
      '2026-04-19',
      '2026-04-19T10:00:00',
      'FT X/1',
      100,
      '',
      keys.privateKey,
    );
    expect(
      service.verifyHash(
        '2026-04-19',
        '2026-04-19T10:00:00',
        'FT X/1',
        100,
        '',
        hash,
        keys.publicKey,
      ),
    ).toBe(true);
  });
});
