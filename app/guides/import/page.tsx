"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState } from 'react';
import Image from 'next/image';
import {
  ShieldCheck,
  Route,
  Building2,
  ParkingCircle,
  PackageOpen,
  RotateCcw,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Import,
  MapPin,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';

const STEPS = [
  {
    key: 'security',
    icon: ShieldCheck,
    color: 'from-blue-500 to-blue-600',
    accent: 'bg-blue-50 border-blue-200 text-blue-700',
    badge: 'bg-blue-500',
    images: [] as string[],
  },
  {
    key: 'route_map',
    icon: Route,
    color: 'from-emerald-500 to-emerald-600',
    accent: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    badge: 'bg-emerald-500',
    images: ['route-map'],
  },
  {
    key: 'office',
    icon: Building2,
    color: 'from-violet-500 to-violet-600',
    accent: 'bg-violet-50 border-violet-200 text-violet-700',
    badge: 'bg-violet-500',
    images: ['office-exterior', 'office-interior'],
  },
  {
    key: 'waiting_area',
    icon: ParkingCircle,
    color: 'from-amber-500 to-amber-600',
    accent: 'bg-amber-50 border-amber-200 text-amber-700',
    badge: 'bg-amber-500',
    images: ['waiting-area'],
  },
  {
    key: 'unloading_area',
    icon: PackageOpen,
    color: 'from-orange-500 to-orange-600',
    accent: 'bg-orange-50 border-orange-200 text-orange-700',
    badge: 'bg-orange-500',
    images: ['unloading-area'],
  },
  {
    key: 'return_office',
    icon: RotateCcw,
    color: 'from-cyan-500 to-cyan-600',
    accent: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    badge: 'bg-cyan-500',
    images: [] as string[],
  },
  {
    key: 'documents',
    icon: FileText,
    color: 'from-rose-500 to-rose-600',
    accent: 'bg-rose-50 border-rose-200 text-rose-700',
    badge: 'bg-rose-500',
    images: [] as string[],
  },
] as const;

function ImageFrame({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="relative w-full aspect-[4/3] rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2">
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
          <MapPin className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-xs text-gray-400 font-medium text-center px-4">{caption}</p>
        <p className="text-[10px] text-gray-300">{src.split('/').pop()}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 shadow-md group">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        sizes="(max-width: 768px) 100vw, 50vw"
        onError={() => setError(true)}
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
        <p className="text-white text-xs font-medium drop-shadow-sm">{caption}</p>
      </div>
    </div>
  );
}

export default function ImportGuidePage() {
  const { t } = useLanguage();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const toggleStep = (idx: number) => {
    setExpandedStep(expandedStep === idx ? null : idx);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Hero Banner */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white rounded-full" />
        </div>

        <div className="relative px-4 py-6 pb-8">
          {/* Back button */}
          <a href="/" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('back')}
          </a>

          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-lg">
              <Import className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight leading-tight">{t('guide_import_title')}</h1>
              <p className="text-blue-100 text-xs mt-1 leading-relaxed">{t('guide_import_subtitle')}</p>
            </div>
          </div>

          {/* Quick info chips */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1 text-[10px] font-medium">
              <Route className="w-3 h-3" />
              7 {t('guide_steps')}
            </span>
            <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1 text-[10px] font-medium">
              <Phone className="w-3 h-3" />
              {t('guide_contact_security')}
            </span>
          </div>
        </div>

        {/* Wave separator */}
        <div className="absolute -bottom-px left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" className="w-full h-6">
            <path d="M0 48h1440V20C1200 0 960 40 720 24S240 0 0 20v28z" className="fill-slate-50" />
          </svg>
        </div>
      </div>

      {/* Important Notice */}
      <div className="px-4 -mt-1 mb-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800">{t('guide_import_notice_title')}</p>
            <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">{t('guide_import_notice_desc')}</p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 pb-8 space-y-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isExpanded = expandedStep === idx;
          const hasImages = step.images.length > 0;

          return (
            <div
              key={step.key}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-shadow hover:shadow-md"
            >
              {/* Step Header */}
              <button
                onClick={() => hasImages && toggleStep(idx)}
                className={`w-full flex items-center gap-3 p-3.5 text-left ${hasImages ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {/* Step number badge */}
                <div className={`relative shrink-0`}>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-sm`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className={`absolute -top-1 -right-1 w-4.5 h-4.5 ${step.badge} rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-sm`}>
                    {idx + 1}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                    {t(`guide_import_step${idx + 1}_title`)}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                    {t(`guide_import_step${idx + 1}_desc`)}
                  </p>
                </div>

                {/* Expand indicator */}
                {hasImages && (
                  <div className="shrink-0 text-gray-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                )}
              </button>

              {/* Step 1: Security — inline details */}
              {step.key === 'security' && (
                <div className="px-3.5 pb-3.5 -mt-1">
                  <div className={`rounded-xl p-3 ${step.accent} border`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold">{t('guide_import_security_info')}</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] leading-relaxed">
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />
                        {t('guide_import_security_1')}
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />
                        {t('guide_import_security_2')}
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />
                        {t('guide_import_security_3')}
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Step 6: Return to office — inline reminder */}
              {step.key === 'return_office' && (
                <div className="px-3.5 pb-3.5 -mt-1">
                  <div className={`rounded-xl p-3 ${step.accent} border`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold">{t('guide_import_return_info')}</span>
                    </div>
                    <ul className="space-y-1.5 text-[11px] leading-relaxed">
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />
                        {t('guide_import_return_1')}
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />
                        {t('guide_import_return_2')}
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Step 7: Documents — inline checklist */}
              {step.key === 'documents' && (
                <div className="px-3.5 pb-3.5 -mt-1">
                  <div className="space-y-2">
                    {/* Document cards */}
                    {(['customs_declaration', 'work_order'] as const).map((docKey) => (
                      <div key={docKey} className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl p-3">
                        <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                          <FileText className="w-4.5 h-4.5 text-rose-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-rose-800">{t(`guide_import_doc_${docKey}`)}</p>
                          <p className="text-[10px] text-rose-600">{t(`guide_import_doc_${docKey}_desc`)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expandable Image Gallery */}
              {hasImages && isExpanded && (
                <div className="px-3.5 pb-3.5 -mt-1 space-y-2.5">
                  <div className={step.images.length === 2 ? 'grid grid-cols-2 gap-2.5' : ''}>
                    {step.images.map((imgName) => (
                      <ImageFrame
                        key={imgName}
                        src={`/images/guides/${imgName}.jpg`}
                        alt={t(`guide_import_img_${imgName.replace(/-/g, '_')}`)}
                        caption={t(`guide_import_img_${imgName.replace(/-/g, '_')}`)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom summary card */}
      <div className="px-4 pb-8">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 text-white shadow-lg">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {t('guide_import_summary_title')}
          </h3>
          <div className="mt-3 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] text-gray-300">
                <span className="w-4.5 h-4.5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                  {i}
                </span>
                <span>{t(`guide_import_summary_${i}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
