"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useMemo, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { YardCheck, YardCheckType } from '@/types';
import { formatDateTimeRelative } from '@/utils/format';
import { getYardEmptyDisplayStatus } from '@/utils/styles';
import { useYardChecks } from '@/hooks';
import { SearchInput, BottomSheet } from '@/components/ui';
import { YardCheckModal, type YardCheckModalMode } from '@/components/yardcheck/YardCheckModal';
import {
  MoreVertical,
  Trash2,
  Pencil,
  Package,
  Plus,
  ScanLine,
} from 'lucide-react';

// Lucide has no "license plate" glyph — a small plate-shaped rect reads clearer
// than the Truck icon, which people mistake for "this is a tractor unit" rather
// than the chassis's own registration number.
function PlateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <line x1="6" y1="14" x2="18" y2="14" />
    </svg>
  );
}

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
  const [emptyStatusFilter, setEmptyStatusFilter] = useState<'passed' | 'not_passed' | null>(null);
  const [activeTab, setActiveTab] = useState<'in' | 'out'>('in');
  const [outRange, setOutRange] = useState<'24h' | '7d' | 'all'>('24h');
  const [actionCheck, setActionCheck] = useState<YardCheck | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCheck, setDeletingCheck] = useState<YardCheck | null>(null);
  const [markOutCheck, setMarkOutCheck] = useState<YardCheck | null>(null);

  const [modalMode, setModalMode] = useState<YardCheckModalMode>('update');
  const [modalOpen, setModalOpen] = useState(false);
  const [initialInspect, setInitialInspect] = useState<YardCheck | null>(null);
  const [initialEdit, setInitialEdit] = useState<YardCheck | null>(null);

  const { checks, loading, refetch, markOut, deleteCheck, actionLoading } = useYardChecks({});

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

  // Clicking Passed/Not Passed under the Empty card narrows straight to that
  // subset (and pins the type filter to Empty, since the split only means
  // anything there); clicking the same one again clears back to all Empty.
  const toggleEmptyStatusFilter = (status: 'passed' | 'not_passed') => {
    if (emptyStatusFilter === status) {
      setEmptyStatusFilter(null);
    } else {
      setEmptyStatusFilter(status);
      setTypeFilters(new Set(['empty']));
    }
  };

  const matchesFilters = useCallback((c: YardCheck) => {
    if (typeFilters.size > 0 && !typeFilters.has(c.type)) return false;
    if (emptyStatusFilter) {
      if (c.type !== 'empty') return false;
      const disp = getYardEmptyDisplayStatus(c);
      if (emptyStatusFilter === 'passed' && disp !== 'passed') return false;
      if (emptyStatusFilter === 'not_passed' && disp === 'passed') return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = `${c.container_no || ''} ${c.chassis_plate}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }, [typeFilters, emptyStatusFilter, searchQuery]);

  // A record still needs action if it's physically in the yard (needs mark-out), or
  // if it's an empty container whose checklist isn't passed yet — even if it already
  // left, so checkers can go back and correct a wrong/incomplete inspection.
  const needsAction = useCallback((c: YardCheck) => {
    if (c.yard_status === 'in') return true;
    return c.type === 'empty' && getYardEmptyDisplayStatus(c) !== 'passed';
  }, []);

  const inYard = useMemo(
    () => checks.filter((c) => needsAction(c) && matchesFilters(c)),
    [checks, matchesFilters, needsAction]
  );

  const outList = useMemo(() => {
    const now = Date.now();
    const rangeMs = outRange === '24h' ? 24 * 60 * 60 * 1000 : outRange === '7d' ? 7 * 24 * 60 * 60 * 1000 : null;
    return checks.filter((c) => {
      if (c.yard_status !== 'out') return false;
      if (!matchesFilters(c)) return false;
      if (rangeMs === null) return true;
      const outAt = c.updated_at ? new Date(c.updated_at) : new Date(c.checked_at);
      return now - outAt.getTime() <= rangeMs;
    });
  }, [checks, matchesFilters, outRange]);

  const stats = useMemo(() => {
    const emptyAction = checks.filter((c) => c.type === 'empty' && needsAction(c));
    const ladenAction = checks.filter((c) => c.type === 'laden' && needsAction(c));
    const chassisAction = checks.filter((c) => c.type === 'chassis' && needsAction(c));
    return {
      emptyTotal: emptyAction.length,
      emptyPassed: emptyAction.filter((c) => getYardEmptyDisplayStatus(c) === 'passed').length,
      emptyNotPassed: emptyAction.filter((c) => getYardEmptyDisplayStatus(c) !== 'passed').length,
      ladenTotal: ladenAction.length,
      chassisTotal: chassisAction.length,
    };
  }, [checks, needsAction]);

  const confirmMarkOut = async () => {
    if (!markOutCheck) return;
    const ok = await markOut(markOutCheck);
    if (ok) setMarkOutCheck(null);
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
    setInitialEdit(null);
    setModalMode(mode);
    setModalOpen(true);
  };

  const openEditModal = (check: YardCheck) => {
    setInitialInspect(null);
    setInitialEdit(check);
    setModalMode('update');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setInitialInspect(null);
    setInitialEdit(null);
    if (searchParams.get('inspect')) {
      window.history.replaceState(null, '', '/yardcheck/summary');
    }
  };

  const getTypeBadgeClass = (type: YardCheckType) => {
    if (type === 'empty') return 'bg-amber-100 text-amber-800';
    if (type === 'laden') return 'bg-blue-100 text-blue-800';
    return 'bg-violet-100 text-violet-800';
  };

  // Size badge follows the record's type color; container no. always uses one
  // consistent accent so it reads as "the same kind of field" across every row.
  const getSizeBadgeClass = (type: YardCheckType) => {
    if (type === 'empty') return 'bg-amber-50 text-amber-700';
    if (type === 'laden') return 'bg-blue-50 text-blue-700';
    return 'bg-violet-50 text-violet-700';
  };
  const CONTAINER_NO_CLASS = 'text-indigo-600';

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
            <span className="font-mono text-sm font-semibold text-gray-900 flex items-center gap-1 w-[94px] shrink-0">
              <PlateIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="tabular-nums truncate">{c.chassis_plate}</span>
            </span>
            {c.size && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${getSizeBadgeClass(c.type)}`}>{c.size}</span>}
            {c.container_no && (
              <span className={`text-[10px] font-medium truncate shrink-0 ${CONTAINER_NO_CLASS}`}>{c.container_no}</span>
            )}
            {c.type === 'chassis' && <span className="text-[10px] text-gray-400">{t('yc_no_container')}</span>}
            {c.yard_status === 'out' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-semibold shrink-0">
                {t('yc_departed_label')}
              </span>
            )}
          </div>
          <button onClick={() => setActionCheck(actionCheck?.id === c.id ? null : c)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 shrink-0">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {c.yard_status === 'out' && disp !== 'passed' && (
          <div className="px-3 pt-1">
            <p className="text-[10px] text-amber-600">{t('yc_already_out_hint')}</p>
          </div>
        )}

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
              className="shrink-0 w-24 text-center text-[10px] px-2 py-1 rounded-md bg-amber-500 text-white font-medium"
            >
              {hasNg ? t('yc_reinspect') : t('yc_inspect')}
            </button>
          ) : (
            <button
              onClick={() => setMarkOutCheck(c)}
              disabled={actionLoading}
              className="shrink-0 w-24 text-center text-[10px] px-2 py-1 rounded-md bg-gray-800 text-white font-medium disabled:opacity-50"
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
        {/* Stat cards (also act as type filter toggles) */}
        <div className="px-3 pt-2.5 pb-2.5">
          <div className="grid grid-cols-3 gap-2">
            <div
              className={`text-left rounded-xl border p-2.5 transition-all flex flex-col ${
                typeFilters.has('empty') ? 'border-amber-500 bg-amber-100 ring-2 ring-amber-300' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <button onClick={() => { toggleTypeFilter('empty'); setEmptyStatusFilter(null); }} className="text-left">
                <div className="text-[10px] font-semibold text-amber-700 mb-1">{t('yc_type_empty').toUpperCase()}</div>
                <div className="text-2xl font-bold text-amber-900 leading-none">{stats.emptyTotal}</div>
              </button>
              <div className="mt-1.5 space-y-0.5">
                <button
                  onClick={() => toggleEmptyStatusFilter('passed')}
                  className={`flex items-center gap-1 text-[10px] text-emerald-700 rounded px-1 -mx-1 ${
                    emptyStatusFilter === 'passed' ? 'bg-emerald-200 font-bold' : ''
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{t('yc_passed')} {stats.emptyPassed}
                </button>
                <button
                  onClick={() => toggleEmptyStatusFilter('not_passed')}
                  className={`flex items-center gap-1 text-[10px] text-red-600 font-medium rounded px-1 -mx-1 ${
                    emptyStatusFilter === 'not_passed' ? 'bg-red-200' : ''
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />{t('yc_not_passed')} {stats.emptyNotPassed}
                </button>
              </div>
            </div>
            <button
              onClick={() => { toggleTypeFilter('laden'); setEmptyStatusFilter(null); }}
              className={`text-left rounded-xl border p-2.5 transition-all flex flex-col ${
                typeFilters.has('laden') ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-300' : 'border-blue-200 bg-blue-50'
              }`}
            >
              <div className="text-[10px] font-semibold text-blue-700 mb-1">{t('yc_type_laden').toUpperCase()}</div>
              <div className="text-2xl font-bold text-blue-900 leading-none">{stats.ladenTotal}</div>
            </button>
            <button
              onClick={() => { toggleTypeFilter('chassis'); setEmptyStatusFilter(null); }}
              className={`text-left rounded-xl border p-2.5 transition-all flex flex-col ${
                typeFilters.has('chassis') ? 'border-violet-500 bg-violet-100 ring-2 ring-violet-300' : 'border-violet-200 bg-violet-50'
              }`}
            >
              <div className="text-[10px] font-semibold text-violet-700 mb-1">{t('yc_type_chassis').toUpperCase()}</div>
              <div className="text-2xl font-bold text-violet-900 leading-none">{stats.chassisTotal}</div>
            </button>
          </div>
        </div>

        {/* Search + Update */}
        <div className="px-3 pb-2.5 flex items-center gap-2">
          <div className="flex-1">
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={t('search_placeholder')} />
          </div>
          <button
            onClick={() => openModal('update')}
            title={t('yc_mode_update')}
            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            <ScanLine className="w-4 h-4 text-amber-600" />
          </button>
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
            {t('yc_out_today_section').toUpperCase()} · {outList.length}
          </button>
        </div>

        {activeTab === 'out' && (
          <div className="flex px-3 pb-2.5 gap-1.5">
            {(['24h', '7d', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setOutRange(r)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                  outRange === r ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {t(`yc_range_${r}`)}
              </button>
            ))}
          </div>
        )}
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
        ) : outList.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-6 bg-gray-50 rounded-lg border border-gray-200">
            {t('yc_no_records')}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200">
            {outList.map((c) => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-[11px]">
                <span className={`text-[9px] px-1 py-0.5 rounded font-semibold shrink-0 w-14 text-center ${getTypeBadgeClass(c.type)}`}>
                  {t(`yc_type_${c.type}`)}
                </span>
                <span className="font-mono font-medium text-gray-700 flex items-center gap-1 w-[94px] shrink-0">
                  <PlateIcon className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="tabular-nums truncate">{c.chassis_plate}</span>
                </span>
                <span className={`truncate flex-1 font-mono font-medium ${CONTAINER_NO_CLASS}`}>{c.container_no || ''}</span>
                <span className="text-gray-400 shrink-0">{c.size || '—'}</span>
                <span className="text-gray-400 shrink-0 text-right">{formatDateTimeRelative(c.updated_at || c.checked_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating action button: straight to Create */}
      <div className="absolute bottom-5 right-4 z-30">
        <button
          onClick={() => openModal('create')}
          title={t('yc_mode_create')}
          className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-xl flex items-center justify-center transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Create/Update modal */}
      <YardCheckModal
        isOpen={modalOpen}
        mode={modalMode}
        onClose={closeModal}
        onSaved={refetch}
        initialInspect={initialInspect}
        initialEdit={initialEdit}
      />

      {/* Action sheet */}
      <BottomSheet
        isOpen={!!actionCheck}
        onClose={() => setActionCheck(null)}
        title={actionCheck ? (actionCheck.container_no || actionCheck.chassis_plate) : ''}
        cancelLabel={t('cc_cancel')}
      >
        {actionCheck && (
          <>
            <button
              onClick={() => { openEditModal(actionCheck); setActionCheck(null); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-700 text-sm"
            >
              <Pencil className="w-4 h-4" />
              {t('yc_edit_record')}
            </button>
            <button
              onClick={() => { setDeletingCheck(actionCheck); setShowDeleteModal(true); setActionCheck(null); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              {t('delete') || 'Delete'}
            </button>
          </>
        )}
      </BottomSheet>

      {/* Mark OUT confirm */}
      {markOutCheck && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setMarkOutCheck(null)}
        >
          <div className="bg-white rounded-xl p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-2">
              <PlateIcon className="w-4 h-4 text-gray-700" />
              {markOutCheck.chassis_plate}{markOutCheck.container_no ? ` · ${markOutCheck.container_no}` : ''}
            </p>
            <p className="text-xs text-gray-500 mb-4">{t('yc_confirm_mark_out_body')}</p>
            <div className="flex gap-2">
              <button onClick={() => setMarkOutCheck(null)} className="flex-1 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                {t('cc_cancel')}
              </button>
              <button onClick={confirmMarkOut} disabled={actionLoading} className="flex-1 py-2 rounded-lg text-xs font-medium bg-gray-800 text-white disabled:opacity-50">
                {actionLoading ? '...' : t('yc_mark_out')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteModal && deletingCheck && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDeleteModal(false)}
        >
          <div className="bg-white rounded-xl p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
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
