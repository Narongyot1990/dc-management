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

  // Leader workflow: 1. Plan → 2. Monitor → 3. Map
  const leaderNav = [
    { href: '/plan', label: t('plan'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { href: '/monitor', label: t('monitor'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { href: '/map', label: t('map'), icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  ];

  // Driver workflow: My Trucks (includes time update + scan DC tabs)
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
