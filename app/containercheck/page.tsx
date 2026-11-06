"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ContainerCheck, ContainerCheckFormData, ContainerCheckLocation, ContainerCheckStatus, ContainerScanResult } from '@/types';
import { ContainerScanner } from '@/components/scanner/ContainerScanner';
import { DOCKS, CC_VENDORS } from '@/utils/constants';
import {
  ClipboardCheck,
  ScanLine,
  Building2,
  MapPin,
  ShieldCheck,
  Check,
  X,
  LayoutDashboard,
  Package,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

type PageMode = 'update' | 'create' | 'edit';
type LookupStatus = 'idle' | 'searching' | 'found' | 'not_found';

const initialFormData: ContainerCheckFormData = {
  container_no: '',
  vendor: '',
  location: '',
  dock_no: null,
  status: '',
  remark: '',
};

export default function ContainerCheckPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-80px)]"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600" /></div>}>
      <ContainerCheckForm />
    </Suspense>
  );
}

function ContainerCheckForm() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState<ContainerCheckFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDockSelector, setShowDockSelector] = useState(false);

  // Mode: update (scan & update existing), create (add new), edit (from summary - full access)
  const [mode, setMode] = useState<PageMode>('update');
  const [editId, setEditId] = useState<string | null>(null);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');

  // Cache: fetch all containers once, lookup locally (instant match)
  const cacheRef = useRef<ContainerCheck[]>([]);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    const fetchCache = async () => {
      try {
        const res = await fetch('/api/container-check');
        const data = await res.json();
        if (data.success) {
          cacheRef.current = data.data;
          setCacheReady(true);
        }
      } catch {
        console.error('Failed to load container cache');
      }
    };
    fetchCache();
  }, []);

  // Auto-fill from URL params (edit mode from summary)
  useEffect(() => {
    const edit = searchParams.get('edit');
    if (edit) {
      setMode('edit');
      setEditId(edit);
      setFormData({
        container_no: searchParams.get('container_no') || '',
        vendor: (searchParams.get('vendor') || '') as ContainerCheckFormData['vendor'],
        location: (searchParams.get('location') || '') as ContainerCheckFormData['location'],
        dock_no: searchParams.get('dock_no') || null,
        status: (searchParams.get('status') || '') as ContainerCheckFormData['status'],
        remark: searchParams.get('remark') || '',
      });
      setLookupStatus('found');
    }
  }, [searchParams]);

  // Instant local lookup from cache
  const lookupFromCache = useCallback((containerNo: string, currentMode: PageMode) => {
    if (!containerNo || containerNo.length < 4 || !cacheReady) {
      setLookupStatus('idle');
      return;
    }
    const match = cacheRef.current.find((c) => c.container_no === containerNo);
    if (match) {
      setLookupStatus('found');
      if (currentMode === 'update') {
        setEditId(match.id);
        setFormData({
          container_no: match.container_no,
          vendor: match.vendor,
          location: match.location,
          dock_no: match.dock_no,
          status: match.status,
          remark: match.remark || '',
        });
      }
    } else {
      setLookupStatus('not_found');
      if (currentMode === 'update') setEditId(null);
    }
  }, [cacheReady]);

  // Refresh cache after successful submit (keeps cache in sync)
  const refreshCache = useCallback(async () => {
    try {
      const res = await fetch('/api/container-check');
      const data = await res.json();
      if (data.success) cacheRef.current = data.data;
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (mode !== 'update' && mode !== 'create') return;
    if (!formData.container_no || formData.container_no.length < 4) {
      setLookupStatus('idle');
      if (mode === 'update') setEditId(null);
      return;
    }
    // Instant lookup — no debounce needed
    lookupFromCache(formData.container_no, mode);
  }, [formData.container_no, mode, lookupFromCache]);

  const handleScanComplete = ({ containerNumber }: ContainerScanResult) => {
    setFormData({ ...formData, container_no: containerNumber });
    setShowScanner(false);
  };

  const handleModeChange = (newMode: PageMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setFormData(initialFormData);
    setEditId(null);
    setLookupStatus('idle');
  };

  const handleLocationSelect = (loc: ContainerCheckLocation) => {
    if (loc === 'dock') {
      setFormData({ ...formData, location: 'dock', status: 'loading' });
      setShowDockSelector(true);
    } else {
      setFormData({ ...formData, location: 'yard', dock_no: null, status: '' });
    }
  };

  const handleDockSelect = (dock: string) => {
    setFormData({ ...formData, dock_no: dock });
    setShowDockSelector(false);
  };

  const handleSubmit = async () => {
    if (!formData.container_no || !formData.vendor || !formData.location || !formData.status) return;
    if (formData.location === 'dock' && !formData.dock_no) {
      setShowDockSelector(true);
      return;
    }

    setLoading(true);
    try {
      let method: string;
      let body: Record<string, unknown>;

      if (mode === 'edit') {
        // Edit from summary: PUT with record ID
        method = 'PUT';
        body = { id: editId, ...formData };
      } else if (mode === 'update') {
        // Update mode: POST upsert by container_no (no id needed)
        method = 'POST';
        body = { ...formData };
      } else {
        // Create mode: POST with mode flag (reject duplicates)
        method = 'POST';
        body = { ...formData, mode: 'create' };
      }

      const response = await fetch('/api/container-check', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await response.json();
        await refreshCache();
        const msg = (mode === 'update' || mode === 'edit') ? t('cc_updated_success') : t('cc_save_success');
        alert(msg);
        if (mode === 'edit') {
          window.location.href = '/containercheck/summary';
        } else {
          setFormData(initialFormData);
          setEditId(null);
          setLookupStatus('idle');
        }
      } else if (response.status === 409) {
        alert(t('cc_container_exists'));
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (mode === 'edit') {
      window.location.href = '/containercheck/summary';
    } else {
      setFormData(initialFormData);
      setEditId(null);
      setLookupStatus('idle');
    }
  };

  // Vendor editable only in create and edit mode
  const isVendorEditable = mode === 'create' || mode === 'edit';

  // In update mode, block if container is already departed
  const isDeparted = mode === 'update' && lookupStatus === 'found' && formData.status === 'departed';

  // Form validation
  const isFormValid = (() => {
    if (isDeparted) return false;
    if (!formData.container_no || !formData.vendor || !formData.location || !formData.status) return false;
    if (formData.location === 'dock' && !formData.dock_no) return false;
    if (mode === 'update' && lookupStatus !== 'found') return false;
    if (mode === 'create' && lookupStatus === 'found') return false; // duplicate
    return true;
  })();

  // Status options depend on location + mode
  const getStatusOptions = (): { id: ContainerCheckStatus; color: string; activeColor: string }[] => {
    const options: { id: ContainerCheckStatus; color: string; activeColor: string }[] = [];

    if (formData.location === 'yard') {
      options.push(
        { id: 'pending', color: 'border-gray-300 hover:bg-gray-50', activeColor: 'bg-amber-500 text-white border-amber-500' },
        { id: 'loaded', color: 'border-gray-300 hover:bg-gray-50', activeColor: 'bg-emerald-500 text-white border-emerald-500' },
      );
    } else if (formData.location === 'dock') {
      options.push(
        { id: 'loading', color: 'border-gray-300 hover:bg-gray-50', activeColor: 'bg-blue-500 text-white border-blue-500' },
      );
    }

    // Departed only in edit mode (admin from summary)
    if (mode === 'edit') {
      options.push(
        { id: 'departed', color: 'border-gray-300 hover:bg-gray-50', activeColor: 'bg-slate-600 text-white border-slate-600' },
      );
    }

    return options;
  };

  const getStatusLabel = (status: ContainerCheckStatus) => {
    switch (status) {
      case 'pending': return t('cc_status_pending');
      case 'loading': return t('cc_status_loading');
      case 'loaded': return t('cc_status_loaded');
      case 'departed': return t('cc_status_departed');
      default: return status;
    }
  };

  return (
    <div className="max-w-lg mx-auto p-4 h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-amber-600" />
          {t('cc_form_title')}
          {mode === 'edit' && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-normal">
              {t('cc_editing')}
            </span>
          )}
        </h1>
        <a href="/containercheck/summary">
          <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium flex items-center gap-1.5 text-gray-700">
            <LayoutDashboard className="w-3.5 h-3.5" />
            {t('cc_summary')}
          </button>
        </a>
      </div>

      {/* Mode Selector (only show when not in edit mode from summary) */}
      {mode !== 'edit' && (
        <div className="flex bg-gray-100 rounded-lg p-0.5 mb-3 shrink-0">
          <button
            onClick={() => handleModeChange('update')}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'update'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('cc_mode_update')}
          </button>
          <button
            onClick={() => handleModeChange('create')}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'create'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('cc_mode_create')}
          </button>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white rounded-xl border border-border p-4 flex-1 flex flex-col overflow-y-auto min-h-0 space-y-4">

        {/* 1. Container No */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            {t('cc_container_no')}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={formData.container_no}
                onChange={(e) => setFormData({ ...formData, container_no: e.target.value.toUpperCase() })}
                placeholder="TCLU1234567"
                readOnly={mode === 'edit'}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                  mode === 'edit' ? 'bg-gray-50 border-gray-200' : 'border-gray-300'
                }`}
              />
              {/* Lookup indicator for update & create mode */}
              {(mode === 'update' || mode === 'create') && formData.container_no.length >= 4 && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  {lookupStatus === 'searching' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                  {mode === 'update' && lookupStatus === 'found' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {mode === 'update' && lookupStatus === 'not_found' && <AlertCircle className="w-4 h-4 text-red-400" />}
                  {mode === 'create' && lookupStatus === 'found' && <AlertCircle className="w-4 h-4 text-orange-400" />}
                  {mode === 'create' && lookupStatus === 'not_found' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shrink-0"
              title={t('cc_scan_container')}
            >
              <ScanLine className="w-5 h-5" />
            </button>
          </div>
          {/* Lookup messages — update mode */}
          {mode === 'update' && lookupStatus === 'not_found' && formData.container_no.length >= 4 && (
            <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {t('cc_not_found_in_system')}
            </p>
          )}
          {mode === 'update' && lookupStatus === 'found' && !isDeparted && (
            <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {t('cc_found_in_system')}
            </p>
          )}
          {isDeparted && (
            <p className="text-[10px] text-orange-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {t('cc_already_departed')}
            </p>
          )}
          {/* Lookup messages — create mode */}
          {mode === 'create' && lookupStatus === 'found' && formData.container_no.length >= 4 && (
            <p className="text-[10px] text-orange-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {t('cc_container_exists')}
            </p>
          )}
          {mode === 'create' && lookupStatus === 'not_found' && formData.container_no.length >= 4 && (
            <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {t('cc_create_ready')}
            </p>
          )}
        </div>

        {/* 2. Vendor - grid-cols-5 compact */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            {t('cc_vendor')}
            {!isVendorEditable && formData.vendor && (
              <span className="text-[10px] text-gray-400 font-normal">({t('cc_readonly')})</span>
            )}
          </label>
          {isVendorEditable ? (
            <div className="grid grid-cols-5 gap-1.5 mt-1.5">
              {CC_VENDORS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFormData({ ...formData, vendor: v })}
                  className={`py-2 rounded-lg text-xs font-medium transition-all border text-center ${
                    formData.vendor === v
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          ) : (
            // Read-only vendor display in update mode
            <div className="mt-1.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-medium text-gray-700">
              {formData.vendor || '-'}
            </div>
          )}
        </div>

        {/* 3. Location: Yard / Dock */}
        {(mode !== 'update' || lookupStatus === 'found') && !isDeparted && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {t('cc_location')}
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => handleLocationSelect('yard')}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-1.5 ${
                  formData.location === 'yard'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {t('cc_location_yard')}
              </button>
              <button
                type="button"
                onClick={() => handleLocationSelect('dock')}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-1.5 ${
                  formData.location === 'dock'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {formData.location === 'dock' && formData.dock_no
                  ? `${t('cc_location_dock')} ${formData.dock_no}`
                  : t('cc_location_dock')
                }
              </button>
            </div>
            {formData.location === 'dock' && formData.dock_no && (
              <button
                onClick={() => setShowDockSelector(true)}
                className="mt-1.5 text-[10px] text-blue-600 hover:underline"
              >
                {t('cc_select_dock')}: {formData.dock_no} (tap to change)
              </button>
            )}
          </div>
        )}

        {/* 4. Status - depends on location */}
        {formData.location && (mode !== 'update' || lookupStatus === 'found') && !isDeparted && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t('cc_status')}
            </label>
            <div className={`grid gap-2 mt-1.5 ${
              getStatusOptions().length === 1 ? 'grid-cols-1' :
              getStatusOptions().length === 2 ? 'grid-cols-2' :
              'grid-cols-3'
            }`}>
              {getStatusOptions().map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, status: opt.id })}
                  className={`px-2 py-2.5 rounded-lg text-xs font-medium transition-all border flex items-center justify-center gap-1 ${
                    formData.status === opt.id ? opt.activeColor : opt.color
                  } ${formData.status !== opt.id ? 'bg-white text-gray-700' : ''}`}
                >
                  {getStatusLabel(opt.id)}
                </button>
              ))}
            </div>
            {formData.location === 'dock' && mode !== 'edit' && (
              <p className="text-[10px] text-gray-400 mt-1">* {t('cc_status_loading')} auto-selected</p>
            )}
          </div>
        )}

        {/* 5. Remark */}
        {(mode !== 'update' || lookupStatus === 'found') && !isDeparted && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
              {t('remark')}
            </label>
            <input
              type="text"
              value={formData.remark || ''}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              placeholder={t('remark')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* 5. Action Buttons */}
        <div className="flex gap-3 pt-2 shrink-0">
          <button
            onClick={handleReset}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
            {t('cc_cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || loading}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:text-gray-500 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors"
          >
            <Check className="w-4 h-4" />
            {loading ? '...' : t('cc_confirm')}
          </button>
        </div>
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <ContainerScanner
          onScan={handleScanComplete}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Dock Selector Modal */}
      {showDockSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-3 border-b shrink-0">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                {t('cc_select_dock')}
              </h3>
              <button
                onClick={() => {
                  if (!formData.dock_no) {
                    setFormData({ ...formData, location: '', status: '' });
                  }
                  setShowDockSelector(false);
                }}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              <div className="grid grid-cols-4 gap-2">
                {DOCKS.map((dock) => (
                  <button
                    key={dock}
                    onClick={() => handleDockSelect(dock)}
                    className={`py-2.5 px-2 rounded-lg text-xs font-medium transition-all border text-center ${
                      formData.dock_no === dock
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-300'
                    }`}
                  >
                    {dock}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
