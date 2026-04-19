/**
 * Normalize a phone number to E.164 format.
 *
 * Rules:
 * - If the input is exactly 9 digits starting with 92/93/94/95, assume an
 *   Angolan mobile and prepend `+244` (ignoring any stray leading `+`).
 * - Else if the input starts with `+` and has at least 10 digits, trust it
 *   as full international format.
 * - Otherwise reject with a human-readable error.
 *
 * Returns `{ number }` on success or `{ number: '', error }` on failure.
 */
export function normalizePhone(input: string): { number: string; error?: string } {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 9 && /^9[2-5]/.test(digits)) {
    return { number: `+244${digits}` };
  }

  if (trimmed.startsWith('+')) {
    if (digits.length < 10) {
      return { number: '', error: 'Phone number too short — include full country code' };
    }
    return { number: `+${digits}` };
  }

  return {
    number: '',
    error: 'Use an Angolan 9-digit number (e.g. 923456789) or + and full country code (e.g. +351912345678).',
  };
}

/**
 * Convenience: normalize and return just the digits (no leading `+`).
 * Used for WhatsApp Cloud API which expects digits only.
 */
export function normalizePhoneDigits(input: string): { digits: string; error?: string } {
  const res = normalizePhone(input);
  if (res.error) return { digits: '', error: res.error };
  return { digits: res.number.replace(/^\+/, '') };
}
