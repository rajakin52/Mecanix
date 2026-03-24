/**
 * Sanitize a search string for safe use in PostgREST filter expressions.
 * Strips characters that could break or inject into .or() filter clauses.
 */
export function sanitizeSearch(input: string): string {
  return input.replace(/[,.()"'\\]/g, '').trim();
}
