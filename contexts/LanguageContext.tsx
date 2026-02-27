'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import th from '@/locales/th.json';
import en from '@/locales/en.json';

type Lang = 'th' | 'en';

const translations: Record<Lang, Record<string, string>> = { th, en };

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'th',
  setLang: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('th');

  const t = useCallback(
    (key: string) => translations[lang]?.[key] || key,
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
