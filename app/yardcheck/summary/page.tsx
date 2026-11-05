"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useMemo, useCallback } from 'react';
import type { YardCheck, YardCheckType } from '@/types';
import { getRelativeTime } from '@/utils/format';
import { useYardChecks } from '@/hooks';
import { SearchInput, BottomSheet } from '@/components/ui';
import { YARD_NAME } from '@/utils/constants';
import {
  ClipboardCheck,
  ArrowLeft,
  AlertCircle,
  MoreVertical,
  Trash2,
  Package,
  Truck,
} from 'lucide-react';

export default function YardCheckSummaryPage() {
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<YardCheckType | 'all'>('all');
  const [outExpanded, setOutExpanded] = useState(false);
  const [actionCheck, setActionCheck] = useState<YardCheck | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCheck, setDeletingCheck] = useState<YardCheck | null>(null);

  const { checks, loading, markOut, deleteCheck, actionLoading } = useYardChecks({});

  const matchesFilters = useCallback((c: YardCheck) => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = `${c.container_no || ''} ${c.chassis_plate}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }, [typeFilter, searchQuery]);

  const inYard = useMemo(
    () => checks.filter((c) => c.yard_status === 'in' && matchesFilters(c)),
    [checks, matchesFilters]
  );

  const outToday = useMemo(() => {
    const todayStr = new Date().toDateString();
    return checks.filter((c) => {
      if (c.yard_status !== 'out') return false;
      if (!matchesFilters(c)) return false;
      const outAt = c.updated_at ? new Date(c.updated_at) : new Date(c.checked_at);
      return outAt.toDateString() === todayStr;
    });
  }, [checks, matchesFilters]);

  const stats = useMemo(() => {
    const emptyIn = checks.filter((c) => c.type === 'empty' && c.yard_status === 'in');
    const ladenIn = checks.filter((c) => c.type === 'laden' && c.yard_status === 'in');
    const chassisIn = checks.filter((c) => c.type === 'chassis' && c.yard_status === 'in');
    const todayStr = new Date().toDateString();
    const ladenInToday = checks.filter((c) => c.type === 'laden' && new Date(c.checked_at).toDateString() === todayStr).length;
    const ladenOutToday = checks.filter((c) => c.type === 'laden' && c.yard_status === 'out' && c.updated_at && new Date(c.updated_at).toDateString() === todayStr).length;
    return {
      emptyTotal: emptyIn.length,
      emptyPassed: emptyIn.filter((c) => c.inspection_status === 'passed').length,
      emptyPending: emptyIn.filter((c) => c.inspection_status === 'pending').length,
      ladenTotal: ladenIn.length,
      ladenInToday,
      ladenOutToday,
      chassisTotal: chassisIn.length,
    };
  }, [checks]);

  const handleMarkOut = async (check: YardCheck) => {
    await markOut(check);
  };

  const handleDelete = async () => {
    if (!deletingCheck) return;
    const ok = await deleteCheck(deletingCheck);
    if (ok) {
      setShowDeleteModal(false);
      setDeletingCheck(null);
    }
  };

  const getTypeBadgeClass = (type: YardCheckType) => {
    if (type === 'empty') return 'bg-amber-100 text-amber-800';
    if (type === 'laden') return 'bg-blue-100 text-blue-800';
    return 'bg-violet-100 text-violet-800';
  };

  const getTypeHeaderBg = (type: YardCheckType) => {
    if (type === 'empty') return 'bg-amber-50';
    if (type === 'laden') return 'bg-blue-50';
    return 'bg-violet-50';
  };

  const getCardBorder = (c: YardCheck) => {
    if (c.type === 'empty') {
      if (c.inspection_status === 'pending') return 'border-l-red-500';
      return 'border-l-emerald-500';
    }
    if (c.type === 'laden') return 'border-l-blue-500';
    return 'border-l-violet-400';
  };

  const renderInYardCard = (c: YardCheck) => {
    const pending = c.type === 'empty' && c.inspection_status === 'pending';
    const hasNg = c.type === 'empty' && (c.checklist || []).some((item) => item.result === 'fail');

    return (
      <div key={c.id} className={`border-l-[3px] ${getCardBorder(c)}`}>
        <div className={`flex items-center justify-between px-3 py-1.5 ${getTypeHeaderBg(c.type)}`}>
          <span className={`text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded ${getTypeBadgeClass(c.type)}`}>
            {t(`yc_type_${c.type}`).toUpperCase()}
          </span>
          <button onClick={() => setActionCheck(actionCheck?.id === c.id ? null : c)} className="p-1 hover:bg-white/60 rounded text-gray-400 hover:text-gray-600">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
        <div className="px-3 py-2">
          <div className="font-mono text-base font-semibold text-gray-900">
            {c.container_no || c.chassis_plate}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            {c.size && <span className="px-1.5 py-0.5 rounded bg-gray-100 font-medium">{c.size}</span>}
            {c.container_no && (
              <span className="flex items-center gap-0.5">
                <Truck className="w-3 h-3" />
                {t('yc_chassis_plate')} {c.chassis_plate}
              </span>
            )}
            {c.seal_no && <span>seal {c.seal_no}</span>}
            {c.type === 'chassis' && <span className="text-gray-400">{t('yc_no_container')}</span>}
          </div>
        </div>
        {hasNg && (
          <div className="px-3 pb-1.5 -mt-1">
            <p className="text-[11px] text-red-700 font-medium">
              ⚠ {t('yc_checklist_title')} {(c.checklist || []).filter((i) => i.result === 'fail').map((i) => i.item).join(', ')}
            </p>
            {c.ng_detail && <p className="text-[10px] text-red-500 mt-0.5 line-clamp-2">{c.ng_detail}</p>}
          </div>
        )}
        <div className={`px-3 py-1.5 flex items-center justify-between gap-2 ${
          hasNg ? 'bg-red-100' : pending ? 'bg-red-50' : c.type === 'empty' ? 'bg-emerald-50' : 'bg-gray-50'
        }`}>
          <span className={`text-[11px] font-medium truncate ${
            hasNg || pending ? 'text-red-700' : c.type === 'empty' ? 'text-emerald-700' : 'text-gray-500'
          }`}>
            {c.type === 'empty' && (
              c.inspection_status === 'passed' ? `${t('yc_passed')} · ` : `${t('yc_pending')} · `
            )}
            {getRelativeTime(c.checked_at, true)}
          </span>
          {pending ? (
            <a href={`/yardcheck?inspect=${c.id}`}>
              <button className="shrink-0 text-[10px] px-2.5 py-1 rounded-md bg-amber-500 text-white font-medium">
                {hasNg ? t('yc_reinspect') : t('yc_inspect')}
              </button>
            </a>
          ) : (
            <button
              onClick={() => handleMarkOut(c)}
              disabled={actionLoading}
              className="shrink-0 text-[10px] px-2.5 py-1 rounded-md bg-gray-800 text-white font-medium disabled:opacity-50"
            >
              {t('yc_mark_out')}
            </button>
          )}
        </div>
      </div>
    );
  };

  const visibleOut = outExpanded ? outToday : outToday.slice(0, 3);

  return (
    <div className="flex flex-col overflow-hidden bg-background h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-border">
        <div className="flex items-center justify-between px-3 py-2.5">
          <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-600" />
            {t('yc_summary')}
            <span className="text-[10px] text-gray-400 font-normal">{YARD_NAME}</span>
          </h1>
          <a href="/yardcheck">
            <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium flex items-center gap-1.5 text-gray-700">
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('back')}
            </button>
          </a>
        </div>

        {/* Stat cards */}
        <div className="px-3 pb-2.5">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
              <div className="text-[10px] font-semibold text-amber-700 mb-1">{t('yc_type_empty').toUpperCase()}</div>
              <div className="text-2xl font-bold text-amber-900 leading-none">{stats.emptyTotal}</div>
              <div className="text-[9px] text-amber-600 mt-0.5 mb-1.5">{t('yc_in_yard_now')}</div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{t('yc_passed')} {stats.emptyPassed}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-red-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />{t('yc_pending')} {stats.emptyPending}
              </div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-2.5">
              <div className="text-[10px] font-semibold text-blue-700 mb-1">{t('yc_type_laden').toUpperCase()}</div>
              <div className="text-2xl font-bold text-blue-900 leading-none">{stats.ladenTotal}</div>
              <div className="text-[9px] text-blue-600 mt-0.5 mb-1.5">{t('yc_in_yard_now')}</div>
              <div className="text-[10px] text-blue-500">{stats.ladenInToday} / {stats.ladenOutToday}</div>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-2.5">
              <div className="text-[10px] font-semibold text-violet-700 mb-1">{t('yc_type_chassis').toUpperCase()}</div>
              <div className="text-2xl font-bold text-violet-900 leading-none">{stats.chassisTotal}</div>
              <div className="text-[9px] text-violet-600 mt-0.5 mb-1.5">{t('yc_in_yard_now')}</div>
              <div className="text-[10px] text-violet-500">{t('yc_bare_chassis')}</div>
            </div>
          </div>

          {stats.emptyPending > 0 && (
            <div className="mt-2 flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 rounded-lg px-2.5 py-1.5 text-[11px] font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {stats.emptyPending} {t('yc_awaiting_checklist')}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="px-3 pb-2.5 space-y-2">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={t('search_placeholder')} />
          <div className="flex gap-1.5 overflow-x-auto">
            <button
              onClick={() => setTypeFilter('all')}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium ${typeFilter === 'all' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {t('yc_all_types')}
            </button>
            {(['empty', 'laden', 'chassis'] as YardCheckType[]).map((ty) => (
              <button
                key={ty}
                onClick={() => setTypeFilter(ty)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                  typeFilter === ty ? getTypeBadgeClass(ty) + ' border-transparent' : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                {t(`yc_type_${ty}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 px-3 py-2 overflow-y-auto space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600" />
          </div>
        ) : (
          <>
            {/* IN YARD */}
            <div>
              <div className="flex items-center gap-2 px-1 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <h2 className="text-xs font-bold text-gray-800 tracking-wide">{t('yc_in_yard_section').toUpperCase()}</h2>
                <span className="text-[11px] text-gray-400">{inYard.length} {t('yc_items_on_site')}</span>
              </div>
              {inYard.length === 0 ? (
                <div className="text-center text-xs text-gray-400 py-6 bg-white rounded-lg border border-gray-200">
                  {t('yc_no_records')}
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-emerald-200 divide-y-4 divide-gray-50 overflow-hidden">
                  {inYard.map(renderInYardCard)}
                </div>
              )}
            </div>

            {/* OUT TODAY */}
            <div>
              <button onClick={() => setOutExpanded((v) => !v)} className="w-full flex items-center gap-2 px-1 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                <h2 className="text-xs font-bold text-gray-500 tracking-wide">{t('yc_out_today_section').toUpperCase()}</h2>
                <span className="text-[11px] text-gray-400">{outToday.length} {t('yc_departed_label')}</span>
              </button>
              {outToday.length === 0 ? (
                <div className="text-center text-xs text-gray-400 py-4 bg-gray-50 rounded-lg border border-gray-200">
                  {t('yc_no_records')}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200 opacity-80">
                  {visibleOut.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                      <span className={`text-[9px] px-1 py-0.5 rounded font-semibold shrink-0 w-14 text-center ${getTypeBadgeClass(c.type)}`}>
                        {t(`yc_type_${c.type}`)}
                      </span>
                      <span className="font-mono font-medium text-gray-700 truncate flex-1">{c.container_no || c.chassis_plate}</span>
                      <span className="text-gray-400 shrink-0">{c.size || '—'}</span>
                      <span className="text-gray-400 shrink-0 w-16 text-right">{getRelativeTime(c.updated_at || c.checked_at, true)}</span>
                    </div>
                  ))}
                  {!outExpanded && outToday.length > 3 && (
                    <button onClick={() => setOutExpanded(true)} className="w-full text-center py-1.5 text-[11px] text-gray-500 hover:text-gray-700 font-medium">
                      {t('yc_show_more')} ({outToday.length - 3})
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Action sheet */}
      <BottomSheet
        isOpen={!!actionCheck}
        onClose={() => setActionCheck(null)}
        title={actionCheck ? (actionCheck.container_no || actionCheck.chassis_plate) : ''}
        cancelLabel={t('cc_cancel')}
      >
        {actionCheck && (
          <button
            onClick={() => { setDeletingCheck(actionCheck); setShowDeleteModal(true); setActionCheck(null); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            {t('delete') || 'Delete'}
          </button>
        )}
      </BottomSheet>

      {/* Delete confirm */}
      {showDeleteModal && deletingCheck && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 max-w-sm w-full">
            <p className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-2">
              <Package className="w-4 h-4 text-red-500" />
              {deletingCheck.container_no || deletingCheck.chassis_plate}
            </p>
            <p className="text-xs text-gray-500 mb-4">Delete this record?</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                {t('cc_cancel')}
              </button>
              <button onClick={handleDelete} disabled={actionLoading} className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-500 text-white disabled:opacity-50">
                {actionLoading ? '...' : t('delete') || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
