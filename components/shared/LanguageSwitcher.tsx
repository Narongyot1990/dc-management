"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

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
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#006cb3] hover:bg-blue-50 transition-colors"
      >
        <span>{currentLang?.code.toUpperCase()}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
                  language === lang.code ? 'bg-blue-50 font-semibold text-[#006cb3]' : 'text-gray-700'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
                {language === lang.code && <Check className="w-3.5 h-3.5 ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
