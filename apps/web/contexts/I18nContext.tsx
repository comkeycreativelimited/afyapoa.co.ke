'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLocale, getTranslation } from '../lib/i18n';

interface I18nContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, defaultText?: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key, defaultText) => defaultText || key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('afyapoa_locale') as SupportedLocale;
      if (saved === 'en' || saved === 'sw') {
        setLocaleState(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      // Ignore localStorage exceptions in SSR/restricted environments
    }
  }, []);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('afyapoa_locale', newLocale);
      document.documentElement.lang = newLocale;
    } catch {
      // Ignore
    }
  };

  const t = (key: string, defaultText?: string): string => {
    return getTranslation(key, locale, defaultText);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);
