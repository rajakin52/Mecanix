/**
 * Masking helpers for sensitive data in log lines.
 * GDPR requires that PII (phone, email, names) should not appear in
 * application logs at INFO/WARN level. Use these to keep enough signal
 * for debugging (country prefix + last 4 digits) without leaking the full
 * identifier.
 */

/** `+244923456789` → `+244***6789`. Safe for `null`/`undefined`. */
export function redactPhone(raw: string | null | undefined): string {
  if (!raw) return '(none)';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  const tail = digits.slice(-4);
  const leadLen = Math.max(0, digits.length - 4 - 3);
  const lead = digits.slice(0, leadLen);
  return `+${lead}***${tail}`;
}

/** `john.doe@example.com` → `j***@example.com`. */
export function redactEmail(raw: string | null | undefined): string {
  if (!raw) return '(none)';
  const at = raw.indexOf('@');
  if (at < 1) return '***';
  const local = raw.slice(0, at);
  const domain = raw.slice(at);
  const head = local.slice(0, 1);
  return `${head}***${domain}`;
}

/** Display name: keep first initial + length for de-duplication. */
export function redactName(raw: string | null | undefined): string {
  if (!raw) return '(none)';
  const first = raw.trim().charAt(0).toUpperCase();
  return `${first}. (${raw.length}ch)`;
}
