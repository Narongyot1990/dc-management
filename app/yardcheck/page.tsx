"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { YardCheck, YardCheckType, YardCheckSize, YardCheckChecklistItem } from '@/types';
import { ContainerScanner } from '@/components/scanner/ContainerScanner';
import { YARD_SIZES, YARD_CHECKLIST, YARD_NAME } from '@/utils/constants';
import {
  ClipboardCheck,
  ScanLine,
  Package,
  Check,
  X,
  LayoutDashboard,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Truck,
} from 'lucide-react';

type PageMode = 'update' | 'create';
type LookupStatus = 'idle' | 'found' | 'not_found';

const initialFormData = {
  container_no: '',
  size: '' as YardCheckSize | '',
  chassis_plate: '',
  seal_no: '',
  remark: '',
};

const emptyChecklist: YardCheckChecklistItem[] = [1, 2, 3, 4, 5].map((item) => ({ item: item as 1 | 2 | 3 | 4 | 5, result: null }));

export default function YardCheckPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<PageMode>('update');
  const [type, setType] = useState<YardCheckType | ''>('');
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Update mode: search + lookup
  const [searchValue, setSearchValue] = useState('');
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const [foundRecord, setFoundRecord] = useState<YardCheck | null>(null);

  // Checklist (active for: just-created empty record, or found pending empty record)
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

  useEffect(() => { refreshCache(); }, [refreshCache]);

  // ---------- Update mode: lookup ----------
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

  // ---------- Create mode: submit ----------
  const handleTypeSelect = (t: YardCheckType) => {
    setType(t);
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
        if (type === 'empty') {
          setInspecting(data.data);
          setChecklist(emptyChecklist);
          setNgDetail('');
        } else {
          alert(t('yc_save_success'));
          setType('');
          setFormData(initialFormData);
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

  // ---------- Mark OUT (update mode, non-empty or already-passed empty) ----------
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
        alert(t('yc_updated_success'));
        setSearchValue('');
        setLookupStatus('idle');
        setFoundRecord(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Continue checklist from update mode ----------
  const startInspecting = (record: YardCheck) => {
    setInspecting(record);
    setChecklist(record.checklist && record.checklist.length === 5 ? record.checklist : emptyChecklist);
    setNgDetail(record.ng_detail || '');
  };

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
        alert(t('yc_save_success'));
        setInspecting(null);
        setChecklist(emptyChecklist);
        setNgDetail('');
        setType('');
        setFormData(initialFormData);
        setSearchValue('');
        setLookupStatus('idle');
        setFoundRecord(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: PageMode) => {
    setMode(newMode);
    setType('');
    setFormData(initialFormData);
    setSearchValue('');
    setLookupStatus('idle');
    setFoundRecord(null);
    setInspecting(null);
  };

  // ======================================================================
  // RENDER: Checklist panel (shared by create-then-inspect and update-continue)
  // ======================================================================
  if (inspecting) {
    return (
      <div className="max-w-lg mx-auto p-4 h-[calc(100vh-80px)] flex flex-col">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div>
            <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-amber-600" />
              {t('yc_form_title')}
            </h1>
            <p className="text-[11px] text-gray-400 mt-0.5 ml-7">
              {YARD_NAME} · {inspecting.container_no} · {inspecting.size} · {inspecting.chassis_plate}
            </p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full font-semibold bg-red-100 text-red-700 shrink-0">
            {checkedCount}/5
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pb-3">
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

        <div className="shrink-0 border-t border-border pt-3">
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
    );
  }

  // ======================================================================
  // RENDER: Main form (Update / Create)
  // ======================================================================
  return (
    <div className="max-w-lg mx-auto p-4 h-[calc(100vh-80px)] flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-amber-600" />
          {t('yc_form_title')}
          <span className="text-xs text-gray-400 font-normal">{YARD_NAME}</span>
        </h1>
        <a href="/yardcheck/summary">
          <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium flex items-center gap-1.5 text-gray-700">
            <LayoutDashboard className="w-3.5 h-3.5" />
            {t('yc_summary')}
          </button>
        </a>
      </div>

      {/* Mode selector */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 mb-3 shrink-0">
        <button
          onClick={() => handleModeChange('update')}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === 'update' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('yc_mode_update')}
        </button>
        <button
          onClick={() => handleModeChange('create')}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === 'create' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('yc_mode_create')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border p-4 flex-1 flex flex-col overflow-y-auto min-h-0 space-y-4">

        {mode === 'update' ? (
          <>
            {/* Search field */}
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

            {/* Found record detail + actions */}
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
                  {foundRecord.type === 'empty' && (
                    <p className={`text-[11px] mt-2 font-medium ${foundRecord.inspection_status === 'passed' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {foundRecord.inspection_status === 'passed' ? t('yc_passed') : t('yc_pending')}
                    </p>
                  )}
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
            {/* Type selector */}
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

            <div className="flex-1" />

            <div className="flex gap-3 pt-2 shrink-0">
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
          </>
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
