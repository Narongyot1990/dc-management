"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';
import { ClipboardList, Truck, Package, ClipboardCheck } from 'lucide-react';

export default function HomePage() {
  const { t } = useLanguage();

  const roles = [
    {
      href: '/planner',
      icon: ClipboardList,
      title: t('planner'),
      description: 'Manage container jobs',
      gradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      hoverBorder: 'hover:border-blue-200',
      arrow: 'group-hover:text-blue-600',
    },
    {
      href: '/driver',
      icon: Truck,
      title: t('driver'),
      description: 'View and complete jobs',
      gradient: 'from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      hoverBorder: 'hover:border-emerald-200',
      arrow: 'group-hover:text-emerald-600',
    },
    {
      href: '/bookingmanagement',
      icon: Package,
      title: t('booking_records'),
      description: 'Manage bookings',
      gradient: 'from-violet-500 to-violet-600',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      hoverBorder: 'hover:border-violet-200',
      arrow: 'group-hover:text-violet-600',
    },
    {
      href: '/containercheck',
      icon: ClipboardCheck,
      title: t('container_check'),
      description: 'Container inspection',
      gradient: 'from-amber-500 to-amber-600',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      hoverBorder: 'hover:border-amber-200',
      arrow: 'group-hover:text-amber-600',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-16">
      {/* Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {roles.map((role) => {
          const Icon = role.icon;
          return (
            <Link key={role.href} href={role.href} className="group">
              <div className={`bg-white rounded-xl border border-border ${role.hoverBorder} p-6 md:p-8 transition-all duration-200 hover:shadow-(--shadow-lg) cursor-pointer`}>
                {/* Icon */}
                <div className={`w-12 h-12 md:w-14 md:h-14 bg-linear-to-br ${role.gradient} rounded-xl flex items-center justify-center mb-4 md:mb-5 shadow-sm`}>
                  <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={1.75} />
                </div>

                {/* Content */}
                <h2 className="text-lg md:text-xl font-semibold text-text-primary mb-1.5">
                  {role.title}
                </h2>
                <p className="text-xs md:text-sm text-text-muted mb-4">
                  {role.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
