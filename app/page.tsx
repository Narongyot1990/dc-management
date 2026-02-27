'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRole } from '@/contexts/RoleContext';
import type { Role } from '@/contexts/RoleContext';

export default function HomePage() {
  const { t } = useLanguage();
  const { role, setRole } = useRole();
  const router = useRouter();

  // Auto-redirect if role already selected
  useEffect(() => {
    if (role === 'leader') router.replace('/monitor');
    if (role === 'driver') router.replace('/driver');
  }, [role, router]);

  const handleSelectRole = (r: Role) => {
    setRole(r);
    if (r === 'driver') {
      router.push('/driver');
    } else if (r === 'leader') {
      router.push('/monitor');
    }
  };

  // If role already selected, show nothing while redirecting
  if (role) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo + Title */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200/50">
            <svg className="h-11 w-11 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17h.01M16 17h.01M3 13h18M3 13V8a2 2 0 012-2h8l4 4h2a2 2 0 012 2v1M3 13l1 4h1a2 2 0 104 0h6a2 2 0 104 0h1l1-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{t('app_title')}</h1>
          <p className="text-gray-500 mt-2 text-base">{t('select_role_subtitle')}</p>
        </div>

        {/* Role Cards */}
        <div className="space-y-4">
          {/* Leader Card */}
          <button
            onClick={() => handleSelectRole('leader')}
            className="w-full group bg-white rounded-2xl shadow-sm border-2 border-gray-100 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 p-6 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-blue-50 group-hover:bg-blue-100 rounded-2xl flex items-center justify-center transition-colors shrink-0">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-gray-800">{t('role_leader')}</h2>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wide">
                    {t('all_features')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{t('role_leader_desc')}</p>
              </div>
              <svg className="h-5 w-5 text-gray-300 group-hover:text-blue-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Driver Card */}
          <button
            onClick={() => handleSelectRole('driver')}
            className="w-full group bg-white rounded-2xl shadow-sm border-2 border-gray-100 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/50 p-6 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-emerald-50 group-hover:bg-emerald-100 rounded-2xl flex items-center justify-center transition-colors shrink-0">
                <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17h.01M16 17h.01M3 13h18M3 13V8a2 2 0 012-2h8l4 4h2a2 2 0 012 2v1M3 13l1 4h1a2 2 0 104 0h6a2 2 0 104 0h1l1-4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-800 mb-1">{t('role_driver')}</h2>
                <p className="text-sm text-gray-500 leading-relaxed">{t('role_driver_desc')}</p>
              </div>
              <svg className="h-5 w-5 text-gray-300 group-hover:text-emerald-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
