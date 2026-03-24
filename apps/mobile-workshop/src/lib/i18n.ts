import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import ptPT from '../locales/pt-PT.json';
import ptBR from '../locales/pt-BR.json';
import en from '../locales/en.json';

const deviceLocale = Localization.getLocales()[0]?.languageTag ?? 'pt-PT';

i18next.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: {
    'pt-PT': { translation: ptPT },
    'pt-BR': { translation: ptBR },
    en: { translation: en },
  },
  lng: deviceLocale.startsWith('pt-BR') ? 'pt-BR' : deviceLocale.startsWith('pt') ? 'pt-PT' : 'en',
  fallbackLng: 'pt-PT',
  interpolation: { escapeValue: false },
});

export default i18next;
