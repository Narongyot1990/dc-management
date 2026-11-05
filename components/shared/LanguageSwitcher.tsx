"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState } from 'react';

const languages = [
  { code: 'th', label: 'ไทย', flag: '🇹🇭' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'cn', label: '中文', flag: '🇨🇳' },
  { code: 'mm', label: 'မြန်မာ', flag: '🇲🇲' },
] as const;

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const currentLang = languages.find(lang => lang.code === language);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 transition-colors"
      >
        <span>🌐</span>
        <span className="font-medium">{currentLang?.code.toUpperCase()}</span>
        <span className="text-xs">▼</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                  language === lang.code ? 'bg-blue-50 font-semibold text-blue-600' : ''
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
                {language === lang.code && <span className="ml-auto">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
