"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'th' | 'en' | 'cn' | 'mm';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // อ่านค่าจาก LocalStorage หรือใช้ค่า default 'th'
  const [language, setLanguageState] = useState<Language>('th');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage after mount (client-side only)
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('app_language');
    if (saved && ['th', 'en', 'cn', 'mm'].includes(saved)) {
      setLanguageState(saved as Language);
    }
  }, []);

  // โหลดไฟล์แปลภาษา
  useEffect(() => {
    import(`@/locales/${language}.json`)
      .then((module) => setTranslations(module.default))
      .catch((err) => console.error('Failed to load translations:', err));
  }, [language]);

  // เปลี่ยนภาษาและบันทึกลง LocalStorage
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (mounted) {
      localStorage.setItem('app_language', lang);
    }
  };

  // ฟังก์ชันแปลภาษา
  const t = (key: string): string => {
    return translations[key] || key;
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
