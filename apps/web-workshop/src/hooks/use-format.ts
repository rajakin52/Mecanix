'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useTenantContext } from '@/lib/tenant-context';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';

/**
 * Hook that returns locale-aware formatting functions using the tenant's currency.
 *
 * Usage:
 *   const { money, date, number } = useFormat();
 *   money(3750)     → "3.750,00 Kz" (for AOA tenant in pt-PT)
 *   date('2026-03-20') → "20 de mar. de 2026"
 *   number(1500)    → "1.500"
 */
export function useFormat() {
  const { currency } = useTenantContext();
  const locale = useLocale();

  const money = useCallback(
    (amount: number | string | null | undefined) => formatCurrency(amount, currency, locale),
    [currency, locale],
  );

  const date = useCallback(
    (d: string | null | undefined, options?: Intl.DateTimeFormatOptions) =>
      formatDate(d, locale, options),
    [locale],
  );

  const number = useCallback(
    (value: number | string | null | undefined, decimals = 0) =>
      formatNumber(value, locale, decimals),
    [locale],
  );

  return { money, date, number, currency, locale };
}
