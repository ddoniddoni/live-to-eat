import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../../locales/en.json';
import ko from '../../locales/ko.json';

const languageCode = getLocales()[0]?.languageCode;

void i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  lng: languageCode === 'ko' ? 'ko' : 'en',
  resources: {
    en: { translation: en },
    ko: { translation: ko },
  },
});

export default i18n;
