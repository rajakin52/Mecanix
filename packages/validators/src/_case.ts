/**
 * Text normalization helpers used inside Zod `.transform(...)` on incoming
 * form/API payloads. Applied symmetrically on the frontend (zodResolver)
 * and the backend (ZodValidationPipe) so data is canonical on save.
 *
 * Idempotent — running them twice produces the same output.
 */

/** Collapse internal whitespace and trim. Base step for every other helper. */
function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Title Case for proper nouns (customer names, vehicle make/model, vendor names).
 * Leaves short all-caps tokens alone so acronyms/brands like BMW, GPS, VW survive.
 */
export function titleCase(s: string): string {
  const t = tidy(s);
  if (!t) return t;
  return t.replace(/\p{L}[\p{L}\p{M}'’\-]*/gu, (word) => {
    if (word.length <= 4 && word === word.toUpperCase()) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

/** UPPERCASE with internal whitespace removed. For plates, VIN, codes. */
export function upperCase(s: string): string {
  return tidy(s).toUpperCase();
}

/**
 * Sentence case for free-form text (reported problem, notes, remarks).
 * Only the first letter of the string is forced upper; the rest is left alone
 * so existing capitalisation of names/acronyms inside the body is preserved.
 */
export function sentenceCase(s: string): string {
  const t = tidy(s);
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
