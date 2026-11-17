"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import type { YardCheck, YardCheckType, YardCheckSize } from '@/types';
import { ContainerScanner } from '@/components/scanner/ContainerScanner';
import { SearchInput } from '@/components/ui';
import { PlateIcon } from '@/components/yardcheck/PlateIcon';
import { getYardCardTypeBadgeClass, getYardCardSizeBadgeClass, getYardCardTypeBorderClass, YARD_CARD_CONTAINER_NO_CLASS } from '@/utils/styles';
import { YARD_SIZES, YARD_NAME } from '@/utils/constants';
import { formatDateTimeRelative } from '@/utils/format';
import {
  ClipboardCheck,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Plus,
  ScanLine,
  Loader2,
  Trash2,
  Truck,
  X,
} from 'lucide-react';

interface NewAssetDraft {
  localId: string;
  type: YardCheckType;
  container_no: string;
  size: YardCheckSize | '';
  chassis_plate: string;
  seal_no: string;
}

const DRAFT_KEY = 'yc_inventory_draft';
const emptyNewAsset = (): NewAssetDraft => ({
  localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  type: 'empty',
  container_no: '',
  size: '',
  chassis_plate: '',
  seal_no: '',
});

export default function InventoryCheckPage() {
  const { t } = useLanguage();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<'list' | 'summary'>('list');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inYardList, setInYardList] = useState<YardCheck[]>([]);
  const [typeFilter, setTypeFilter] = useState<YardCheckType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stillHere, setStillHere] = useState<Set<string>>(new Set());
  const [newAssets, setNewAssets] = useState<NewAssetDraft[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<NewAssetDraft>(emptyNewAsset());
  const [showScanner, setShowScanner] = useState(false);

  // Load the live "in yard" list fresh, then restore any draft left over
  // from a previous session - but only the still-here ticks that still
  // refer to a record that's actually still "in" (someone else may have
  // acted on it in the meantime).
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/yard-check?yard_status=in');
        const data = await res.json();
        if (cancelled) return;
        const list: YardCheck[] = data.success ? data.data : [];
        list.sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime());
        setInYardList(list);

        const validIds = new Set(list.map((c) => c.id));
        try {
          const raw = localStorage.getItem(DRAFT_KEY);
          if (raw) {
            const draft = JSON.parse(raw);
            const restoredStillHere = new Set<string>(
              Array.isArray(draft.stillHereIds) ? draft.stillHereIds.filter((id: string) => validIds.has(id)) : []
            );
            setStillHere(restoredStillHere);
            setNewAssets(Array.isArray(draft.newAssets) ? draft.newAssets : []);
          }
        } catch { /* ignore invalid draft */ }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Persist the draft on every change so a closed app / refresh mid-walk
  // doesn't lose what's already been ticked off.
  useEffect(() => {
    if (loading) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ stillHereIds: Array.from(stillHere), newAssets }));
    } catch { /* storage unavailable */ }
  }, [loading, stillHere, newAssets]);

  const toggleStillHere = (id: string) => {
    setStillHere((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddFormSubmit = () => {
    if (!addForm.chassis_plate) return;
    if ((addForm.type === 'empty' || addForm.type === 'laden') && (!addForm.container_no || !addForm.size)) return;
    setNewAssets((prev) => [...prev, { ...addForm, chassis_plate: addForm.chassis_plate.toUpperCase(), container_no: addForm.container_no.toUpperCase() }]);
    setAddForm(emptyNewAsset());
    setShowAddModal(false);
  };

  const removeNewAsset = (localId: string) => {
    setNewAssets((prev) => prev.filter((a) => a.localId !== localId));
  };

  const handleScanComplete = ({ containerNumber, size, chassisPlate }: { containerNumber: string; size?: YardCheckSize | null; chassisPlate?: string | null }) => {
    setAddForm((f) => ({
      ...f,
      container_no: containerNumber,
      size: size && (f.type === 'empty' || f.type === 'laden') ? size : f.size,
      chassis_plate: chassisPlate || f.chassis_plate,
    }));
    setShowScanner(false);
  };

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }, []);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/yard-check/inventory-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stillHereIds: Array.from(stillHere),
          newAssets: newAssets.map((a) => ({
            type: a.type,
            container_no: a.type === 'chassis' ? undefined : a.container_no,
            size: a.type === 'chassis' ? undefined : a.size || undefined,
            chassis_plate: a.chassis_plate,
            seal_no: a.type === 'laden' ? a.seal_no || undefined : undefined,
          })),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(`Error: ${error.error}`);
        return;
      }
      clearDraft();
      router.push('/yardcheck/summary');
    } catch (error) {
      console.error(error);
      alert('Failed to save inventory check');
    } finally {
      setSubmitting(false);
    }
  };

  const typeCounts = {
    empty: inYardList.filter((c) => c.type === 'empty').length,
    laden: inYardList.filter((c) => c.type === 'laden').length,
    chassis: inYardList.filter((c) => c.type === 'chassis').length,
  };

  const visibleList = inYardList.filter((c) => {
    if (typeFilter && c.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.chassis_plate?.toLowerCase().includes(q) && !c.container_no?.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const markOutCount = inYardList.length - stillHere.size;

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100dvh-104px)] gap-3 text-center px-4">
        <ClipboardCheck className="w-10 h-10 text-gray-300" />
        <p className="text-sm text-gray-500">{t('login_readonly_hint')}</p>
        <Link href="/yardcheck/summary" className="text-sm text-[#006cb3] font-medium">{t('yc_inv_back')}</Link>
      </div>
    );
  }

  return (
    <div className="fls-yard-summary relative mx-auto flex max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 h-[calc(100dvh-104px)] min-h-[360px]">
      <div className="shrink-0 border-b border-slate-200 bg-white p-3">
        <div className="flex items-start gap-2">
          <Link href="/yardcheck/summary" aria-label={t('yc_inv_back')} className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#006cb3]" />
              {t('yc_inv_title')}
              <span className="text-xs text-gray-400 font-normal">{YARD_NAME}</span>
            </h1>
          </div>
        </div>

        {step === 'list' && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#006cb3] transition-all"
                style={{ width: `${inYardList.length ? (stillHere.size / inYardList.length) * 100 : 0}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] font-semibold text-gray-500 tabular-nums">
              {stillHere.size}/{inYardList.length} {t('yc_inv_checked_count')}
            </span>
          </div>
        )}

        {step === 'list' && (
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('search_placeholder')}
            ringColor="focus:ring-[#006cb3]"
            className="mt-2.5"
          />
        )}

        {step === 'list' && (
          // Single-select, unlike Summary's multi-select pills - deliberately
          // different here since walking the yard means focusing on one type
          // at a time, not combining several.
          <div className="flex flex-wrap gap-1.5 mt-2">
            {([
              { key: null, label: t('all'), count: inYardList.length },
              { key: 'empty', label: t('yc_type_empty'), count: typeCounts.empty },
              { key: 'laden', label: t('yc_type_laden'), count: typeCounts.laden },
              { key: 'chassis', label: t('yc_type_chassis'), count: typeCounts.chassis },
            ] as const).map((f) => (
              <button
                key={f.label}
                onClick={() => setTypeFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  typeFilter === f.key ? 'bg-[#006cb3] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {step === 'list' ? (
        <>
          <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-[#006cb3]" />
              </div>
            ) : visibleList.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-6">{t('yc_inv_empty_yard')}</p>
            ) : (
              visibleList.map((c) => {
                const checked = stillHere.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleStillHere(c.id)}
                    className={`w-full overflow-hidden rounded-xl border border-l-4 bg-white p-3 text-left shadow-sm transition-colors flex items-center gap-3 ${getYardCardTypeBorderClass(c.type)} ${
                      checked ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-300' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {checked ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-300 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <span className={`text-[11px] font-semibold tracking-wide px-1.5 py-0.5 rounded shrink-0 ${getYardCardTypeBadgeClass(c.type)}`}>
                          {t(`yc_type_${c.type}`).toUpperCase()}
                        </span>
                        <span className="font-mono text-sm font-semibold text-gray-900 flex items-center gap-1 shrink-0">
                          <PlateIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="tabular-nums">{c.chassis_plate}</span>
                        </span>
                        {c.size && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${getYardCardSizeBadgeClass(c.type)}`}>{c.size}</span>}
                        {c.container_no && (
                          <span className={`text-xs font-medium break-all ${YARD_CARD_CONTAINER_NO_CLASS}`}>{c.container_no}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">{formatDateTimeRelative(c.checked_at)}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${checked ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {t('yc_inv_still_here')}
                    </span>
                  </button>
                );
              })
            )}

            {newAssets.length > 0 && (
              <div className="pt-2">
                <p className="text-[11px] font-semibold text-gray-500 mb-1.5">{t('yc_inv_new_assets_section')} ({newAssets.length})</p>
                <div className="space-y-2">
                  {newAssets.map((a) => (
                    <div key={a.localId} className="overflow-hidden rounded-xl border border-amber-300 border-l-[3px] border-l-amber-500 bg-amber-50 p-3 flex items-center gap-3">
                      <Plus className="w-5 h-5 text-amber-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          <span className="text-[11px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                            {t(`yc_type_${a.type}`).toUpperCase()}
                          </span>
                          <span className="font-mono text-sm font-semibold text-gray-900 flex items-center gap-1 shrink-0">
                            <PlateIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="tabular-nums">{a.chassis_plate || '—'}</span>
                          </span>
                          {a.size && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700 shrink-0">{a.size}</span>}
                          {a.container_no && <span className={`text-xs font-medium break-all ${YARD_CARD_CONTAINER_NO_CLASS}`}>{a.container_no}</span>}
                        </div>
                      </div>
                      <button onClick={() => removeNewAsset(a.localId)} className="p-1 text-gray-400 hover:text-red-500 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Floating add tab - opens a popup instead of an inline form
              buried at the bottom of a possibly-long list */}
          <button
            onClick={() => setShowAddModal(true)}
            className="absolute bottom-20 left-4 right-4 z-20 flex items-center justify-center gap-1.5 rounded-xl border-2 border-amber-400 bg-white/95 backdrop-blur py-2.5 text-sm font-semibold text-amber-600 shadow-lg hover:bg-amber-50"
          >
            <Plus className="w-4 h-4" />
            {t('yc_inv_add_found')}
          </button>

          <div className="shrink-0 border-t border-border p-3">
            <button
              onClick={() => setStep('summary')}
              disabled={loading}
              className="w-full py-2.5 bg-[#006cb3] hover:bg-[#00568f] disabled:bg-gray-300 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('yc_inv_done')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col items-center text-center pt-1 pb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#006cb3]/10">
                <ClipboardCheck className="w-5 h-5 text-[#006cb3]" />
              </div>
              <h2 className="mt-2 text-sm font-semibold text-text-primary">{t('yc_inv_review_title')}</h2>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-medium leading-tight">{t('yc_inv_still_here_summary')}</span>
                </div>
                <span className="mt-1.5 block text-2xl font-bold text-emerald-700 tabular-nums">{stillHere.size}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Truck className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-medium leading-tight">{t('yc_inv_mark_out_summary')}</span>
                </div>
                <span className="mt-1.5 block text-2xl font-bold text-slate-700 tabular-nums">{markOutCount}</span>
              </div>
              <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between">
                <span className="text-[11px] font-medium text-amber-700 flex items-center gap-1.5"><Plus className="w-4 h-4 shrink-0" />{t('yc_inv_new_summary')}</span>
                <span className="text-xl font-bold text-amber-700 tabular-nums">{newAssets.length}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-[#006cb3] px-4 py-3">
              <span className="text-sm font-medium text-white/90">{t('yc_inv_total_after')}</span>
              <span className="text-xl font-bold text-white tabular-nums">{stillHere.size + newAssets.length}</span>
            </div>
          </div>

          <div className="shrink-0 border-t border-border p-4 flex gap-3">
            <button onClick={() => setStep('list')} disabled={submitting} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              {t('yc_inv_back')}
            </button>
            <button onClick={handleConfirm} disabled={submitting} className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-[#006cb3] hover:bg-[#00568f] disabled:bg-gray-300 text-white flex items-center justify-center gap-1.5">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {t('yc_inv_confirm')}
            </button>
          </div>
        </>
      )}

      {/* Add found asset - a real popup, not an inline form buried at the
          bottom of a potentially long list */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-600" />
                {t('yc_inv_add_found')}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(['empty', 'laden', 'chassis'] as YardCheckType[]).map((ty) => (
                  <button
                    key={ty}
                    onClick={() => setAddForm((f) => ({ ...f, type: ty, container_no: '', size: '' }))}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                      addForm.type === ty ? 'bg-[#006cb3] text-white border-[#006cb3]' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {t(`yc_type_${ty}`)}
                  </button>
                ))}
              </div>

              {(addForm.type === 'empty' || addForm.type === 'laden') && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addForm.container_no}
                    onChange={(e) => setAddForm((f) => ({ ...f, container_no: e.target.value.toUpperCase() }))}
                    placeholder={t('yc_container_no')}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#006cb3]"
                  />
                  <button onClick={() => setShowScanner(true)} className="p-2 bg-[#006cb3] hover:bg-[#00568f] text-white rounded-lg shrink-0">
                    <ScanLine className="w-4 h-4" />
                  </button>
                </div>
              )}

              {(addForm.type === 'empty' || addForm.type === 'laden') && (
                <div className="grid grid-cols-3 gap-2">
                  {YARD_SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setAddForm((f) => ({ ...f, size: s }))}
                      className={`py-1.5 rounded-lg text-xs font-medium border ${addForm.size === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={addForm.chassis_plate}
                onChange={(e) => setAddForm((f) => ({ ...f, chassis_plate: e.target.value.toUpperCase() }))}
                placeholder={t('yc_chassis_plate')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#006cb3]"
              />

              {addForm.type === 'laden' && (
                <input
                  type="text"
                  value={addForm.seal_no}
                  onChange={(e) => setAddForm((f) => ({ ...f, seal_no: e.target.value.toUpperCase() }))}
                  placeholder={t('yc_seal_no')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#006cb3]"
                />
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowAddModal(false); setAddForm(emptyNewAsset()); }} className="flex-1 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                  {t('cc_cancel')}
                </button>
                <button onClick={handleAddFormSubmit} className="flex-1 py-2 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white">
                  {t('yc_inv_add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <ContainerScanner
          mode="yard"
          onScan={handleScanComplete}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
