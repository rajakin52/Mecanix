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
 * Format a monetary amount in both primary and secondary currencies.
 *
 * @param amount - The numeric amount in primary currency
 * @param primaryCurrency - ISO 4217 primary currency code (e.g., 'AOA')
 * @param secondaryCurrency - ISO 4217 secondary currency code (e.g., 'USD') or null
 * @param exchangeRate - How many units of primary = 1 unit of secondary (e.g., 850 means 1 USD = 850 AOA)
 * @param locale - BCP 47 locale string
 * @returns Object with primary and optional secondary formatted strings
 */
export function formatDualCurrency(
  amount: number | string | null | undefined,
  primaryCurrency: string,
  secondaryCurrency: string | null,
  exchangeRate: number | null,
  locale = 'pt-PT',
): { primary: string; secondary: string | null } {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  const primary = formatCurrency(num, primaryCurrency, locale);

  if (!secondaryCurrency || !exchangeRate || exchangeRate <= 0) {
    return { primary, secondary: null };
  }

  const converted = num / exchangeRate;
  const secondary = formatCurrency(converted, secondaryCurrency, locale);
  return { primary, secondary };
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
