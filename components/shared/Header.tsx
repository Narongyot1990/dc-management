"use client";

import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import { Container, User, Home } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  const { t } = useLanguage();

  return (
    <header className="bg-white border-b border-[var(--border)] px-4 md:px-6 py-3 flex items-center justify-between shadow-[var(--shadow)]">
      <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <div className="w-8 h-8 md:w-9 md:h-9 bg-[var(--primary)] rounded-lg flex items-center justify-center">
          <Container className="w-5 h-5 md:w-5.5 md:h-5.5 text-white" strokeWidth={2} />
        </div>
        <h1 className="text-sm md:text-base font-semibold text-[var(--text-primary)] tracking-tight">
          {t('app_title')}
        </h1>
      </Link>

      <div className="flex items-center gap-1.5 md:gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 hover:bg-[var(--muted-bg)] px-2.5 py-2 rounded-lg transition-colors"
        >
          <Home className="w-4 h-4 md:w-5 md:h-5 text-[var(--text-secondary)]" strokeWidth={1.75} />
        </Link>

        <LanguageSwitcher />

        <button className="flex items-center gap-1.5 hover:bg-[var(--muted-bg)] px-2.5 py-2 rounded-lg transition-colors">
          <User className="w-4 h-4 md:w-5 md:h-5 text-[var(--text-secondary)]" strokeWidth={1.75} />
          <span className="text-xs md:text-sm font-medium text-[var(--text-secondary)] hidden sm:inline">
            {t('profile')}
          </span>
        </button>
      </div>
    </header>
  );
}
