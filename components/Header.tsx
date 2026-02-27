'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRole } from '@/contexts/RoleContext';

export default function Header() {
  const { t, lang, setLang } = useLanguage();
  const { role, clearRole } = useRole();
  const pathname = usePathname();
  const router = useRouter();

  // Don't show header on role selection page
  if (!role && pathname === '/') return null;

  const leaderNav = [
    { href: '/monitor', label: t('monitor'), icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { href: '/plan', label: t('plan'), icon: 'M12 4v16m8-8H4' },
    { href: '/scan', label: t('scan'), icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' },
    { href: '/map', label: t('map'), icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  const driverNav = [
    { href: '/driver', label: t('driver_title'), icon: 'M8 17h.01M16 17h.01M3 13h18M3 13V8a2 2 0 012-2h8l4 4h2a2 2 0 012 2v1M3 13l1 4h1a2 2 0 104 0h6a2 2 0 104 0h1l1-4' },
  ];

  const navItems = role === 'driver' ? driverNav : leaderNav;

  const handleSwitchRole = () => {
    clearRole();
    router.push('/');
  };

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className={`w-8 h-8 ${role === 'driver' ? 'bg-emerald-600' : 'bg-blue-600'} rounded-lg flex items-center justify-center`}>
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h.01M16 17h.01M3 13h18M3 13V8a2 2 0 012-2h8l4 4h2a2 2 0 012 2v1M3 13l1 4h1a2 2 0 104 0h6a2 2 0 104 0h1l1-4" />
              </svg>
            </div>
            <span className="font-bold text-gray-800 text-sm hidden sm:inline">{t('app_title')}</span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              const activeClass = role === 'driver' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700';
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    isActive ? activeClass : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}

            {/* Role Badge + Switch */}
            {role && (
              <button
                onClick={handleSwitchRole}
                title={t('switch_role')}
                className={`ml-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  role === 'leader'
                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {role === 'leader' ? t('role_leader') : t('role_driver')}
              </button>
            )}

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
              className="ml-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {lang === 'th' ? 'EN' : 'TH'}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
