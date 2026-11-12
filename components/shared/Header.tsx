"use client";

import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import { Container, User, Home } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const { t } = useLanguage();
  const flsYard = usePathname() === '/yardcheck/summary';

  return (
    <header className={`bg-white border-b border-[var(--border)] px-4 md:px-6 py-3 flex items-center justify-between ${flsYard ? "fls-yard-header gap-2 [font-family:Arial,'Tahoma',sans-serif]" : 'shadow-[var(--shadow)]'}`}>
      <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        {flsYard ? <span role="img" aria-label="FLS" className="block h-9 w-9 shrink-0 rounded-full bg-white bg-no-repeat" style={{ backgroundImage: "url('/brand/fls-logo-source.jpg')", backgroundSize: '112px 57px', backgroundPosition: '-6px -6px' }} /> : <div className="w-8 h-8 md:w-9 md:h-9 bg-[var(--primary)] rounded-lg flex items-center justify-center">
          <Container className="w-5 h-5 md:w-5.5 md:h-5.5 text-white" strokeWidth={2} />
        </div>}
        {flsYard ? <span title="FLS TRANSPORT CO., LTD." className="min-w-0"><strong className="block text-sm font-semibold text-[#006cb3]">FLS Transport</strong><span className="block text-[11px] text-slate-500">{t('app_title')}</span></span> : <h1 className="text-sm md:text-base font-semibold text-[var(--text-primary)] tracking-tight">
          {t('app_title')}
        </h1>}
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
