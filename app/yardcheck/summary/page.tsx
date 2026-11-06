"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useMemo, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { YardCheck, YardCheckType } from '@/types';
import { formatDateTimeRelative } from '@/utils/format';
import { getYardEmptyDisplayStatus } from '@/utils/styles';
import { useYardChecks } from '@/hooks';
import { SearchInput, BottomSheet } from '@/components/ui';
import { YARD_NAME } from '@/utils/constants';
import { YardCheckModal, type YardCheckModalMode } from '@/components/yardcheck/YardCheckModal';
import {
  ClipboardCheck,
  AlertCircle,
  MoreVertical,
  Trash2,
  Package,
  Truck,
  Plus,
  X,
  RefreshCw,
  PackagePlus,
} from 'lucide-react';

export default function YardCheckSummaryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-80px)]"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600" /></div>}>
      <YardCheckSummaryContent />
    </Suspense>
  );
}

function YardCheckSummaryContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState<Set<YardCheckType>>(new Set());
  const [activeTab, setActiveTab] = useState<'in' | 'out'>('in');
  const [actionCheck, setActionCheck] = useState<YardCheck | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCheck, setDeletingCheck] = useState<YardCheck | null>(null);

  const [fabOpen, setFabOpen] = useState(false);
  const [modalMode, setModalMode] = useState<YardCheckModalMode>('update');
  const [modalOpen, setModalOpen] = useState(false);
  const [initialInspect, setInitialInspect] = useState<YardCheck | null>(null);

  const { checks, loading, markOut, deleteCheck, actionLoading } = useYardChecks({});

  // Deep link: /yardcheck/summary?inspect=<id> opens the checklist directly.
  useEffect(() => {
    const inspectId = searchParams.get('inspect');
    if (!inspectId || loading) return;
    const record = checks.find((c) => c.id === inspectId);
    if (record) {
      setInitialInspect(record);
      setModalMode('update');
      setModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading]);

  const toggleTypeFilter = (ty: YardCheckType) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(ty)) next.delete(ty);
      else next.add(ty);
      return next;
    });
  };

  const matchesFilters = useCallback((c: YardCheck) => {
    if (typeFilters.size > 0 && !typeFilters.has(c.type)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = `${c.container_no || ''} ${c.chassis_plate}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }, [typeFilters, searchQuery]);

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
    return {
      emptyTotal: emptyIn.length,
      emptyPassed: emptyIn.filter((c) => c.inspection_status === 'passed').length,
      emptyNotPassed: emptyIn.filter((c) => c.inspection_status !== 'passed').length,
      ladenTotal: ladenIn.length,
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

  const openModal = (mode: YardCheckModalMode) => {
    setInitialInspect(null);
    setModalMode(mode);
    setModalOpen(true);
    setFabOpen(false);
  };

  const closeModal = () => {
    setModalOpen(false);
    setInitialInspect(null);
    if (searchParams.get('inspect')) {
      window.history.replaceState(null, '', '/yardcheck/summary');
    }
  };

  const getTypeBadgeClass = (type: YardCheckType) => {
    if (type === 'empty') return 'bg-amber-100 text-amber-800';
    if (type === 'laden') return 'bg-blue-100 text-blue-800';
    return 'bg-violet-100 text-violet-800';
  };

  const getCardBorder = (c: YardCheck) => {
    if (c.type === 'empty') {
      const disp = getYardEmptyDisplayStatus(c);
      return disp === 'passed' ? 'border-l-emerald-500' : 'border-l-red-500';
    }
    if (c.type === 'laden') return 'border-l-blue-500';
    return 'border-l-violet-400';
  };

  const renderInYardCard = (c: YardCheck) => {
    const disp = c.type === 'empty' ? getYardEmptyDisplayStatus(c) : null;
    const hasNg = c.type === 'empty' && (c.checklist || []).some((item) => item.result === 'fail');
    const statusLabel = disp === 'passed' ? t('yc_passed') : disp === 'failed' ? t('yc_failed') : disp === 'created' ? t('yc_pending') : null;

    return (
      <div key={c.id} className={`border-l-[3px] ${getCardBorder(c)}`}>
        {/* Row 1: type + id + size + chassis + menu */}
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className={`text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded shrink-0 ${getTypeBadgeClass(c.type)}`}>
              {t(`yc_type_${c.type}`).toUpperCase()}
            </span>
            <span className="font-mono text-sm font-semibold text-gray-900 truncate">
              {c.container_no || c.chassis_plate}
            </span>
            {c.size && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 font-medium text-gray-600 shrink-0">{c.size}</span>}
            {c.container_no && (
              <span className="text-[10px] text-gray-400 flex items-center gap-0.5 shrink-0">
                <Truck className="w-3 h-3" />{c.chassis_plate}
              </span>
            )}
            {c.type === 'chassis' && <span className="text-[10px] text-gray-400">{t('yc_no_container')}</span>}
          </div>
          <button onClick={() => setActionCheck(actionCheck?.id === c.id ? null : c)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 shrink-0">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {hasNg && (
          <div className="px-3 pt-1">
            <p className="text-[10px] text-red-600">
              ⚠ {(c.checklist || []).filter((i) => i.result === 'fail').map((i) => i.item).join(', ')}
              {c.ng_detail ? ` · ${c.ng_detail}` : ''}
            </p>
          </div>
        )}

        {/* Row 2: status + time + action */}
        <div className={`flex items-center justify-between gap-2 px-3 py-1.5 mt-1 ${
          hasNg ? 'bg-red-50' : disp === 'passed' ? 'bg-emerald-50' : disp === 'failed' || disp === 'created' ? 'bg-red-50' : 'bg-gray-50'
        }`}>
          <span className={`text-[10px] font-medium truncate ${
            disp === 'passed' ? 'text-emerald-700' : disp ? 'text-red-700' : 'text-gray-500'
          }`}>
            {statusLabel ? `${statusLabel} · ` : ''}{formatDateTimeRelative(c.checked_at)}
          </span>
          {disp && disp !== 'passed' ? (
            <button
              onClick={() => { setInitialInspect(c); setModalMode('update'); setModalOpen(true); }}
              className="shrink-0 text-[10px] px-2.5 py-1 rounded-md bg-amber-500 text-white font-medium"
            >
              {hasNg ? t('yc_reinspect') : t('yc_inspect')}
            </button>
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

  return (
    <div className="flex flex-col overflow-hidden bg-background h-[calc(100vh-80px)] relative">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-border">
        <div className="flex items-center justify-between px-3 py-2.5">
          <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-600" />
            {t('yc_summary')}
            <span className="text-[10px] text-gray-400 font-normal">{YARD_NAME}</span>
          </h1>
        </div>

        {/* Stat cards (also act as type filter toggles) */}
        <div className="px-3 pb-2.5">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => toggleTypeFilter('empty')}
              className={`text-left rounded-xl border p-2.5 transition-all ${
                typeFilters.has('empty') ? 'border-amber-500 bg-amber-100 ring-2 ring-amber-300' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="text-[10px] font-semibold text-amber-700 mb-1">{t('yc_type_empty').toUpperCase()}</div>
              <div className="text-2xl font-bold text-amber-900 leading-none mb-1.5">{stats.emptyTotal}</div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{t('yc_passed')} {stats.emptyPassed}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-red-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />{t('yc_not_passed')} {stats.emptyNotPassed}
              </div>
            </button>
            <button
              onClick={() => toggleTypeFilter('laden')}
              className={`text-left rounded-xl border p-2.5 transition-all ${
                typeFilters.has('laden') ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-300' : 'border-blue-200 bg-blue-50'
              }`}
            >
              <div className="text-[10px] font-semibold text-blue-700 mb-1">{t('yc_type_laden').toUpperCase()}</div>
              <div className="text-2xl font-bold text-blue-900 leading-none">{stats.ladenTotal}</div>
            </button>
            <button
              onClick={() => toggleTypeFilter('chassis')}
              className={`text-left rounded-xl border p-2.5 transition-all ${
                typeFilters.has('chassis') ? 'border-violet-500 bg-violet-100 ring-2 ring-violet-300' : 'border-violet-200 bg-violet-50'
              }`}
            >
              <div className="text-[10px] font-semibold text-violet-700 mb-1">{t('yc_type_chassis').toUpperCase()}</div>
              <div className="text-2xl font-bold text-violet-900 leading-none">{stats.chassisTotal}</div>
            </button>
          </div>

          {stats.emptyNotPassed > 0 && (
            <div className="mt-2 flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 rounded-lg px-2.5 py-1.5 text-[11px] font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {stats.emptyNotPassed} {t('yc_awaiting_checklist')}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-3 pb-2.5">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={t('search_placeholder')} />
        </div>

        {/* IN / OUT tabs */}
        <div className="flex px-3 pb-2.5 gap-2">
          <button
            onClick={() => setActiveTab('in')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wide transition-colors ${
              activeTab === 'in' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {t('yc_in_yard_section').toUpperCase()} · {inYard.length}
          </button>
          <button
            onClick={() => setActiveTab('out')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wide transition-colors ${
              activeTab === 'out' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {t('yc_out_today_section').toUpperCase()} · {outToday.length}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 px-3 py-2 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600" />
          </div>
        ) : activeTab === 'in' ? (
          inYard.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-6 bg-white rounded-lg border border-gray-200">
              {t('yc_no_records')}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-emerald-200 divide-y-4 divide-gray-50 overflow-hidden">
              {inYard.map(renderInYardCard)}
            </div>
          )
        ) : outToday.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-6 bg-gray-50 rounded-lg border border-gray-200">
            {t('yc_no_records')}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200">
            {outToday.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-[11px]">
                <span className={`text-[9px] px-1 py-0.5 rounded font-semibold shrink-0 w-14 text-center ${getTypeBadgeClass(c.type)}`}>
                  {t(`yc_type_${c.type}`)}
                </span>
                <span className="font-mono font-medium text-gray-700 truncate flex-1">{c.container_no || c.chassis_plate}</span>
                <span className="text-gray-400 shrink-0">{c.size || '—'}</span>
                <span className="text-gray-400 shrink-0 text-right">{formatDateTimeRelative(c.updated_at || c.checked_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating action button: Update / Create */}
      <div className="absolute bottom-5 right-4 flex flex-col items-end gap-2 z-30">
        {fabOpen && (
          <div className="flex flex-col items-end gap-2 mb-1">
            <button
              onClick={() => openModal('create')}
              className="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-white shadow-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PackagePlus className="w-4 h-4 text-amber-600" />
              {t('yc_mode_create')}
            </button>
            <button
              onClick={() => openModal('update')}
              className="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-white shadow-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4 text-amber-600" />
              {t('yc_mode_update')}
            </button>
          </div>
        )}
        <button
          onClick={() => setFabOpen((v) => !v)}
          className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-xl flex items-center justify-center transition-transform"
        >
          {fabOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Create/Update modal */}
      <YardCheckModal
        isOpen={modalOpen}
        mode={modalMode}
        onClose={closeModal}
        onSaved={() => {}}
        initialInspect={initialInspect}
      />

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
