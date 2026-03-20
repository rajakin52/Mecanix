export { default as ptPT } from './locales/pt-PT.json';
export { default as ptBR } from './locales/pt-BR.json';
export { default as en } from './locales/en.json';

export const supportedLocales = ['pt-PT', 'pt-BR', 'en'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export const defaultLocale: SupportedLocale = 'pt-PT';
