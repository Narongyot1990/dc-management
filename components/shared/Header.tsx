"use client";

import { useState } from 'react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LoginModal } from './LoginModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { User, Home, LogOut } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  const handleLogout = async () => {
    const result = await logout();
    if (!result.success) {
      alert(t('login_logout_failed'));
    }
  };

  return (
    <header className="fls-yard-header bg-white border-b border-[var(--border)] px-4 md:px-6 py-3 flex items-center justify-between gap-2 shadow-[var(--shadow)]">
      <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity min-w-0">
        <span
          role="img"
          aria-label="FLS Transport"
          className="block h-9 w-9 shrink-0 rounded-full bg-white bg-no-repeat"
          style={{ backgroundImage: "url('/brand/fls-logo-source.jpg')", backgroundSize: '112px 57px', backgroundPosition: '-6px -6px' }}
        />
        <span title="FLS TRANSPORT CO., LTD." className="min-w-0">
          <strong className="block text-sm font-semibold text-[#006cb3] truncate">FLS Transport</strong>
          <span className="block text-[11px] text-slate-500 truncate">{t('app_title')}</span>
        </span>
      </Link>

      <div className="flex items-center gap-1.5 md:gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 hover:bg-[var(--muted-bg)] px-2.5 py-2 rounded-lg transition-colors"
        >
          <Home className="w-4 h-4 md:w-5 md:h-5 text-[var(--text-secondary)]" strokeWidth={1.75} />
        </Link>

        <LanguageSwitcher />

        {user ? (
          <button
            onClick={handleLogout}
            title={t('login_logout')}
            className="flex items-center gap-1.5 hover:bg-[var(--muted-bg)] px-2.5 py-2 rounded-lg transition-colors"
          >
            <User className="w-4 h-4 md:w-5 md:h-5 text-[var(--text-secondary)]" strokeWidth={1.75} />
            <span className="text-xs md:text-sm font-medium text-[var(--text-secondary)] hidden sm:inline">
              {user.username}
            </span>
            <LogOut className="w-3.5 h-3.5 text-[var(--text-secondary)]" strokeWidth={1.75} />
          </button>
        ) : (
          <button
            onClick={() => setLoginOpen(true)}
            className="flex items-center gap-1.5 hover:bg-[var(--muted-bg)] px-2.5 py-2 rounded-lg transition-colors"
          >
            <User className="w-4 h-4 md:w-5 md:h-5 text-[var(--text-secondary)]" strokeWidth={1.75} />
            <span className="text-xs md:text-sm font-medium text-[var(--text-secondary)] hidden sm:inline">
              {t('profile')}
            </span>
          </button>
        )}
      </div>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </header>
  );
}
