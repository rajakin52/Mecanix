'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useTenantContext } from '@/lib/tenant-context';
import { formatCurrency, formatDualCurrency, formatDate, formatNumber } from '@/lib/format';

/**
 * Hook that returns locale-aware formatting functions using the tenant's currency.
 *
 * Usage:
 *   const { money, dualMoney, date, number } = useFormat();
 *   money(3750)       → "3.750,00 Kz" (for AOA tenant in pt-PT)
 *   dualMoney(85000)  → "85.000,00 Kz (100,00 US$)" (if secondary=USD, rate=850)
 *   date('2026-03-20') → "20 de mar. de 2026"
 *   number(1500)      → "1.500"
 */
export function useFormat() {
  const { currency, secondaryCurrency, exchangeRate } = useTenantContext();
  const locale = useLocale();

  const money = useCallback(
    (amount: number | string | null | undefined) => formatCurrency(amount, currency, locale),
    [currency, locale],
  );

  const dualMoney = useCallback(
    (amount: number | string | null | undefined) => {
      const { primary, secondary } = formatDualCurrency(
        amount,
        currency,
        secondaryCurrency,
        exchangeRate,
        locale,
      );
      return secondary ? `${primary} (${secondary})` : primary;
    },
    [currency, secondaryCurrency, exchangeRate, locale],
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

  return { money, dualMoney, date, number, currency, secondaryCurrency, exchangeRate, locale };
}
