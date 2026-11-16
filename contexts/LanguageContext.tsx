"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import th from '@/locales/th.json';
import en from '@/locales/en.json';
import cn from '@/locales/cn.json';
import mm from '@/locales/mm.json';

type Language = 'th' | 'en' | 'cn' | 'mm';

// Loaded statically (not dynamic import()) so switching language can never show
// a stale translation for a beat while the new locale file is still loading -
// the button and the page content always read from the same already-loaded set.
const ALL_TRANSLATIONS: Record<Language, Record<string, string>> = { th, en, cn, mm };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // อ่านค่าจาก LocalStorage หรือใช้ค่า default 'th'
  const [language, setLanguageState] = useState<Language>('th');
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage after mount (client-side only)
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('app_language');
    if (saved && ['th', 'en', 'cn', 'mm'].includes(saved)) {
      setLanguageState(saved as Language);
    }
  }, []);

  // เปลี่ยนภาษาและบันทึกลง LocalStorage
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (mounted) {
      localStorage.setItem('app_language', lang);
    }
  };

  // ฟังก์ชันแปลภาษา - translations for every language are already loaded, so
  // this is always in sync with `language`, never a beat behind it.
  const t = (key: string): string => {
    return ALL_TRANSLATIONS[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Custom Hook
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
