/**
 * Format a monetary amount using the tenant's currency and locale.
 *
 * @param amount - The numeric amount to format
 * @param currency - ISO 4217 currency code (AOA, MZN, BRL, EUR, USD)
 * @param locale - BCP 47 locale string (pt-PT, pt-BR, en)
 * @returns Formatted string like "3.750,00 AOA" or "R$ 3.750,00"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency = 'AOA',
  locale = 'pt-PT',
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    // Fallback if currency code is invalid
    return `${num.toFixed(2)} ${currency}`;
  }
}

/**
 * Format a date string using locale-aware formatting.
 */
export function formatDate(
  date: string | null | undefined,
  locale = 'pt-PT',
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '-';

  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    }).format(new Date(date));
  } catch {
    return date;
  }
}

/**
 * Format a number (non-currency) with locale.
 */
export function formatNumber(
  value: number | string | null | undefined,
  locale = 'pt-PT',
  decimals = 0,
): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
