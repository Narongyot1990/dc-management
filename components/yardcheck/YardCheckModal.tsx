"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { YardCheck, YardCheckType, YardCheckSize, YardCheckChecklistItem } from '@/types';
import { ContainerScanner } from '@/components/scanner/ContainerScanner';
import { YARD_SIZES, YARD_CHECKLIST, YARD_NAME } from '@/utils/constants';
import { getYardEmptyDisplayStatus } from '@/utils/styles';
import {
  ScanLine,
  Package,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Truck,
  ClipboardCheck,
  Clock,
} from 'lucide-react';

export type YardCheckModalMode = 'update' | 'create';

interface YardCheckModalProps {
  isOpen: boolean;
  mode: YardCheckModalMode;
  onClose: () => void;
  onSaved: () => void;
  /** Open directly into the checklist for this record (e.g. deep link from summary). */
  initialInspect?: YardCheck | null;
}

type Step = 'form' | 'created_choice' | 'checklist';
type LookupStatus = 'idle' | 'found' | 'not_found';

const initialFormData = {
  container_no: '',
  size: '' as YardCheckSize | '',
  chassis_plate: '',
  seal_no: '',
  remark: '',
};

const emptyChecklist: YardCheckChecklistItem[] = [1, 2, 3, 4, 5].map((item) => ({ item: item as 1 | 2 | 3 | 4 | 5, result: null }));

export function YardCheckModal({ isOpen, mode, onClose, onSaved, initialInspect }: YardCheckModalProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('form');
  const [type, setType] = useState<YardCheckType | ''>('');
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const [searchValue, setSearchValue] = useState('');
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const [foundRecord, setFoundRecord] = useState<YardCheck | null>(null);

  const [createdRecord, setCreatedRecord] = useState<YardCheck | null>(null);
  const [inspecting, setInspecting] = useState<YardCheck | null>(null);
  const [checklist, setChecklist] = useState<YardCheckChecklistItem[]>(emptyChecklist);
  const [ngDetail, setNgDetail] = useState('');

  const cacheRef = useRef<YardCheck[]>([]);
  const [cacheReady, setCacheReady] = useState(false);

  const refreshCache = useCallback(async () => {
    try {
      const res = await fetch('/api/yard-check');
      const data = await res.json();
      if (data.success) {
        cacheRef.current = data.data;
        setCacheReady(true);
      }
    } catch { /* silent */ }
  }, []);

  const resetAll = useCallback(() => {
    setStep('form');
    setType('');
    setFormData(initialFormData);
    setSearchValue('');
    setLookupStatus('idle');
    setFoundRecord(null);
    setCreatedRecord(null);
    setInspecting(null);
    setChecklist(emptyChecklist);
    setNgDetail('');
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    refreshCache();
    if (initialInspect) {
      setInspecting(initialInspect);
      setChecklist(initialInspect.checklist && initialInspect.checklist.length === 5 ? initialInspect.checklist : emptyChecklist);
      setNgDetail(initialInspect.ng_detail || '');
      setStep('checklist');
    } else {
      resetAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialInspect, refreshCache]);

  const lookupFromCache = useCallback((value: string) => {
    if (!value || value.length < 3 || !cacheReady) {
      setLookupStatus('idle');
      setFoundRecord(null);
      return;
    }
    const v = value.toUpperCase();
    const match = cacheRef.current.find(
      (c) => c.yard_status === 'in' && (c.container_no === v || c.chassis_plate === v)
    );
    if (match) {
      setLookupStatus('found');
      setFoundRecord(match);
    } else {
      setLookupStatus('not_found');
      setFoundRecord(null);
    }
  }, [cacheReady]);

  useEffect(() => {
    lookupFromCache(searchValue);
  }, [searchValue, lookupFromCache]);

  const handleScanComplete = (containerNumber: string) => {
    if (mode === 'update') {
      setSearchValue(containerNumber);
    } else {
      setFormData((f) => ({ ...f, container_no: containerNumber }));
    }
    setShowScanner(false);
  };

  const handleTypeSelect = (ty: YardCheckType) => {
    setType(ty);
    setFormData(initialFormData);
  };

  const isCreateValid = (() => {
    if (!type) return false;
    if (!formData.chassis_plate) return false;
    if ((type === 'empty' || type === 'laden') && (!formData.container_no || !formData.size)) return false;
    return true;
  })();

  const handleCreateSubmit = async () => {
    if (!isCreateValid) return;
    setLoading(true);
    try {
      const body = {
        type,
        container_no: type === 'chassis' ? undefined : formData.container_no,
        size: type === 'chassis' ? undefined : formData.size,
        chassis_plate: formData.chassis_plate,
        seal_no: type === 'laden' ? formData.seal_no || undefined : undefined,
        remark: formData.remark || undefined,
      };
      const response = await fetch('/api/yard-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const data = await response.json();
        await refreshCache();
        onSaved();
        if (type === 'empty') {
          setCreatedRecord(data.data);
          setStep('created_choice');
        } else {
          resetAll();
          onClose();
        }
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkOut = async () => {
    if (!foundRecord) return;
    setLoading(true);
    try {
      const response = await fetch('/api/yard-check', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: foundRecord.id, yard_status: 'out' }),
      });
      if (response.ok) {
        await refreshCache();
        onSaved();
        resetAll();
        onClose();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const startInspecting = useCallback((record: YardCheck) => {
    setInspecting(record);
    setChecklist(record.checklist && record.checklist.length === 5 ? record.checklist : emptyChecklist);
    setNgDetail(record.ng_detail || '');
    setStep('checklist');
  }, []);

  const setResult = (item: number, result: 'pass' | 'fail') => {
    setChecklist((prev) => prev.map((c) => (c.item === item ? { ...c, result } : c)));
  };

  const allChecked = checklist.every((c) => c.result !== null);
  const hasFail = checklist.some((c) => c.result === 'fail');
  const canSubmitChecklist = allChecked && (!hasFail || ngDetail.trim().length > 0);
  const checkedCount = checklist.filter((c) => c.result !== null).length;

  const handleSubmitChecklist = async () => {
    if (!inspecting || !canSubmitChecklist) return;
    setLoading(true);
    try {
      const response = await fetch('/api/yard-check', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inspecting.id, checklist, ng_detail: ngDetail || undefined }),
      });
      if (response.ok) {
        await refreshCache();
        onSaved();
        resetAll();
        onClose();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= Step: created_choice ================= */}
        {step === 'created_choice' && createdRecord && (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">{t('yc_save_success')}</h2>
              <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="font-mono text-base font-semibold text-gray-900">{createdRecord.container_no}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{createdRecord.size} · {createdRecord.chassis_plate}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => startInspecting(createdRecord)}
                className="flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 text-amber-700"
              >
                <ClipboardCheck className="w-6 h-6" />
                <span className="text-xs font-semibold">{t('yc_inspect_now')}</span>
              </button>
              <button
                onClick={handleClose}
                className="flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600"
              >
                <Clock className="w-6 h-6" />
                <span className="text-xs font-semibold">{t('yc_inspect_later')}</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= Step: checklist ================= */}
        {step === 'checklist' && inspecting && (
          <div className="flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0 border-b border-border">
              <div>
                <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-amber-600" />
                  {t('yc_form_title')}
                </h1>
                <p className="text-[11px] text-gray-400 mt-0.5 ml-7">
                  {YARD_NAME} · {inspecting.container_no} · {inspecting.size} · {inspecting.chassis_plate}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] px-2 py-1 rounded-full font-semibold bg-red-100 text-red-700">
                  {checkedCount}/5
                </span>
                <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 p-4">
              {YARD_CHECKLIST.map((def) => {
                const current = checklist.find((c) => c.item === def.item)!;
                const isDone = current.result !== null;
                const isPass = current.result === 'pass';
                const isFail = current.result === 'fail';
                return (
                  <div
                    key={def.item}
                    className={`rounded-xl border overflow-hidden ${
                      isPass ? 'border-emerald-200 bg-emerald-50/40'
                      : isFail ? 'border-red-300 bg-red-50/60'
                      : 'border-amber-300 bg-amber-50/40 ring-2 ring-amber-100'
                    }`}
                  >
                    <div className={`flex items-center justify-between px-3 py-1.5 ${
                      isPass ? 'bg-emerald-50' : isFail ? 'bg-red-100' : 'bg-amber-100'
                    }`}>
                      <span className={`text-[11px] font-bold ${
                        isPass ? 'text-emerald-700' : isFail ? 'text-red-700' : 'text-amber-800'
                      }`}>
                        {t('yc_checklist_title').toUpperCase()} {def.item} · {t(def.labelKey)}
                      </span>
                      {isPass && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      {isFail && <AlertCircle className="w-4 h-4 text-red-600" />}
                      {!isDone && <span className="text-[10px] font-semibold text-amber-700">{t('yc_awaiting_input')}</span>}
                    </div>
                    <div className="flex gap-3 p-3">
                      <img src={`/images/yardcheck/item${def.item}.png`} className="w-20 h-20 object-cover rounded-lg border border-gray-200 shrink-0" alt={t(def.labelKey)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-gray-700 leading-snug">{t(def.descKey)}</p>
                        <p className="text-[10px] text-red-600 mt-1">{t(def.ngKey)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 px-3 pb-3">
                      <button
                        onClick={() => setResult(def.item, 'pass')}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          isPass ? 'bg-emerald-500 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-emerald-50'
                        }`}
                      >
                        ✓ {t('yc_pass')}
                      </button>
                      <button
                        onClick={() => setResult(def.item, 'fail')}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                          isFail ? 'bg-red-500 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-red-50'
                        }`}
                      >
                        ✗ {t('yc_fail')}
                      </button>
                    </div>
                  </div>
                );
              })}

              {hasFail && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <label className="text-[11px] font-semibold text-red-700 flex items-center gap-1 mb-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {t('yc_ng_detail')}
                  </label>
                  <textarea
                    rows={2}
                    value={ngDetail}
                    onChange={(e) => setNgDetail(e.target.value)}
                    placeholder={t('yc_ng_detail_placeholder')}
                    className="w-full text-xs border border-red-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border p-4">
              {!allChecked && (
                <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mb-2 justify-center">
                  <AlertCircle className="w-3 h-3" />
                  {t('yc_finish_all_prompt')}
                </p>
              )}
              <button
                onClick={handleSubmitChecklist}
                disabled={!canSubmitChecklist || loading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-1.5"
              >
                {loading ? '...' : t('yc_submit_inspection')}
              </button>
            </div>
          </div>
        )}

        {/* ================= Step: form (update / create) ================= */}
        {step === 'form' && (
          <div className="flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0 border-b border-border">
              <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-amber-600" />
                {mode === 'update' ? t('yc_mode_update') : t('yc_mode_create')}
                <span className="text-xs text-gray-400 font-normal">{YARD_NAME}</span>
              </h1>
              <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {mode === 'update' ? (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />
                      {t('yc_container_no')} / {t('yc_chassis_plate')}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={searchValue}
                          onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
                          placeholder="TCLU1234567 / 70-1234"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                        {searchValue.length >= 3 && (
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            {lookupStatus === 'found' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                            {lookupStatus === 'not_found' && <AlertCircle className="w-4 h-4 text-red-400" />}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setShowScanner(true)}
                        className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shrink-0"
                        title={t('yc_scan_container')}
                      >
                        <ScanLine className="w-5 h-5" />
                      </button>
                    </div>
                    {lookupStatus === 'not_found' && (
                      <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {t('yc_not_found_in_system')}
                      </p>
                    )}
                    {lookupStatus === 'found' && (
                      <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('yc_found_in_system')}
                      </p>
                    )}
                  </div>

                  {foundRecord && (
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50">
                        <span className="text-[11px] font-bold text-gray-700">{t(`yc_type_${foundRecord.type}`)}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500 text-white">{t('yc_status_in')}</span>
                      </div>
                      <div className="p-3">
                        <div className="font-mono text-base font-semibold text-gray-900">
                          {foundRecord.container_no || foundRecord.chassis_plate}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                          {foundRecord.size && <span className="px-1.5 py-0.5 rounded bg-gray-100 font-medium">{foundRecord.size}</span>}
                          {foundRecord.container_no && <span>{t('yc_chassis_plate')}: {foundRecord.chassis_plate}</span>}
                        </div>
                        {foundRecord.type === 'empty' && (() => {
                          const disp = getYardEmptyDisplayStatus(foundRecord);
                          const cls = disp === 'passed' ? 'text-emerald-600' : disp === 'failed' ? 'text-red-600' : 'text-amber-600';
                          const label = disp === 'passed' ? t('yc_passed') : disp === 'failed' ? t('yc_failed') : t('yc_pending');
                          return <p className={`text-[11px] mt-2 font-medium ${cls}`}>{label}</p>;
                        })()}
                      </div>
                      <div className="flex gap-2 px-3 pb-3">
                        {foundRecord.type === 'empty' && foundRecord.inspection_status === 'pending' ? (
                          <button
                            onClick={() => startInspecting(foundRecord)}
                            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium"
                          >
                            {t('yc_inspect')}
                          </button>
                        ) : (
                          <button
                            onClick={handleMarkOut}
                            disabled={loading}
                            className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1.5"
                          >
                            <Truck className="w-4 h-4" />
                            {loading ? '...' : t('yc_mark_out')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('yc_type')}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['empty', 'laden', 'chassis'] as YardCheckType[]).map((ty) => (
                        <button
                          key={ty}
                          onClick={() => handleTypeSelect(ty)}
                          className={`py-2.5 rounded-lg text-xs font-semibold border transition-all ${
                            type === ty
                              ? ty === 'empty' ? 'bg-amber-500 text-white border-amber-500'
                              : ty === 'laden' ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-violet-500 text-white border-violet-500'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {t(`yc_type_${ty}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(type === 'empty' || type === 'laden') && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        {t('yc_container_no')}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.container_no}
                          onChange={(e) => setFormData({ ...formData, container_no: e.target.value.toUpperCase() })}
                          placeholder="TCLU1234567"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => setShowScanner(true)}
                          className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shrink-0"
                          title={t('yc_scan_container')}
                        >
                          <ScanLine className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {(type === 'empty' || type === 'laden') && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('yc_size')}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {YARD_SIZES.map((s) => (
                          <button
                            key={s}
                            onClick={() => setFormData({ ...formData, size: s })}
                            className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                              formData.size === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {type && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('yc_chassis_plate')}</label>
                      <input
                        type="text"
                        value={formData.chassis_plate}
                        onChange={(e) => setFormData({ ...formData, chassis_plate: e.target.value.toUpperCase() })}
                        placeholder="70-1234"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {type === 'laden' && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('yc_seal_no')}</label>
                      <input
                        type="text"
                        value={formData.seal_no}
                        onChange={(e) => setFormData({ ...formData, seal_no: e.target.value.toUpperCase() })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {type && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1.5 block">{t('remark')}</label>
                      <input
                        type="text"
                        value={formData.remark}
                        onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                        placeholder={t('remark')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {mode === 'create' && (
              <div className="flex gap-3 p-4 pt-3 shrink-0 border-t border-border">
                <button
                  onClick={() => { setType(''); setFormData(initialFormData); }}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                  {t('cc_cancel')}
                </button>
                <button
                  onClick={handleCreateSubmit}
                  disabled={!isCreateValid || loading}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {loading ? '...' : t('cc_confirm')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showScanner && (
        <ContainerScanner
          onScan={handleScanComplete}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
