// src/i18n/index.ts
// i18next initialization for the app. Imported once for its side effects (in
// main.jsx and the test setup) so the shared default i18n instance is ready
// before any component calls useTranslation().

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { STORAGE_KEYS } from '@/lib/constants';
import type { LanguageCode } from '@/types';
import enTranslations from './locales/en.json';
import ptBrTranslations from './locales/pt-BR.json';

// Single source of truth for the languages the UI supports. Mirrors the
// backend's SUPPORTED_LANGUAGES set; keep the two aligned.
export const SUPPORTED_LANGUAGES: readonly LanguageCode[] = ['en', 'pt-BR'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/**
 * Read the persisted language from localStorage, falling back to the default
 * when it is missing or not a supported code. Reading synchronously here means
 * the user's choice applies on first paint — before the /users/me sync runs.
 */
export function getStoredLanguage(): LanguageCode {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }
  const stored = window.localStorage.getItem(STORAGE_KEYS.LANGUAGE) ?? '';
  // Widen to string[] for the includes check — TypeScript's readonly LanguageCode[]
  // does not accept a plain string argument, but the runtime check is what matters.
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)
    ? (stored as LanguageCode)
    : DEFAULT_LANGUAGE;
}

// Initialize the default i18next instance. resources are bundled (small, two
// languages) so there is no async loading step — translations are available
// immediately, which keeps tests synchronous and avoids a loading flash.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    'pt-BR': { translation: ptBrTranslations },
  },
  lng: getStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    // React already escapes values, so i18next's own escaping is redundant.
    escapeValue: false,
  },
  react: {
    // Resources are bundled and loaded synchronously, so there is nothing to
    // wait for — disabling Suspense avoids a needless loading boundary and keeps
    // component rendering (and tests) synchronous.
    useSuspense: false,
  },
});

export default i18n;
