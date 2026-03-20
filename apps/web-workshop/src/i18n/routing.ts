import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['pt-PT', 'pt-BR', 'en'],
  defaultLocale: 'pt-PT',
});
