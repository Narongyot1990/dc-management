"use client";

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useMemo } from 'react';
import type { ContainerCheck, ContainerCheckHistory, ContainerCheckVendor, ContainerCheckStatus, ContainerCheckLocation } from '@/types';
import { CC_VENDORS } from '@/utils/constants';
import { getBangkokDateString, getRelativeTime } from '@/utils/format';
import { getVendorColor, getCCStatusColor } from '@/utils/styles';
import { countByStatus } from '@/utils/stats';
import { useContainerChecks } from '@/hooks';
import { SearchInput, DateRangePicker, StatusFilterPills, BottomSheet } from '@/components/ui';
import type { StatusPill } from '@/components/ui';
import {
  ClipboardCheck,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  LogOut,
  MapPin,
  Layers,
  Package,
  MoreVertical,
  Edit3,
  Trash2,
  Clock,
  Truck,
  Copy,
  CheckCheck,
  ScanEye,
} from 'lucide-react';

const actionIcon = (action: string) => {
  switch (action) {
    case 'create': return '+';
    case 'departed': return '↗';
    default: return '↻';
  }
};

const actionColor = (action: string) => {
  switch (action) {
    case 'create': return 'text-gray-400';
    case 'departed': return 'text-slate-600';
    default: return 'text-amber-600';
  }
};

const buildTimeline = (history?: ContainerCheckHistory[], checkedAt?: string | Date) => {
  if (!history || history.length === 0) {
    return checkedAt ? [{ action: 'create' as const, at: checkedAt }] : [];
  }
  return history;
};

export default function ContainerCheckSummaryPage() {
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<string>(getBangkokDateString(-7));
  const [endDate, setEndDate] = useState<string>(getBangkokDateString());
  const [vendorFilter, setVendorFilter] = useState<ContainerCheckVendor | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ContainerCheckStatus | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<ContainerCheckLocation | 'all'>('all');

  // Data hook (handles fetch, refetch on visibility, departed, delete)
  const { checks, loading, markDeparted, deleteCheck, actionLoading } = useContainerChecks({ startDate, endDate });

  // Action modal
  const [actionCheck, setActionCheck] = useState<ContainerCheck | null>(null);
  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCheck, setDeletingCheck] = useState<ContainerCheck | null>(null);
  // Departed confirmation modal
  const [showDepartedModal, setShowDepartedModal] = useState(false);
  const [departingCheck, setDepartingCheck] = useState<ContainerCheck | null>(null);

  const [copied, setCopied] = useState(false);
  const [checkerMode, setCheckerMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cc_checker_mode') === '1';
    }
    return false;
  });

  const handleConfirmDeparted = async () => {
    if (!departingCheck) return;
    const ok = await markDeparted(departingCheck);
    if (ok) {
      setShowDepartedModal(false);
      setDepartingCheck(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingCheck) return;
    const ok = await deleteCheck(deletingCheck);
    if (ok) {
      setShowDeleteModal(false);
      setDeletingCheck(null);
    }
  };

  const filteredChecks = useMemo(() => {
    const now = new Date().getTime();
    const STALE_MS = 30 * 60 * 1000;

    return checks.filter((c) => {
      if (vendorFilter !== 'all' && c.vendor !== vendorFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (locationFilter !== 'all' && c.location !== locationFilter) return false;
      if (searchQuery) {
        if (!c.container_no.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      if (checkerMode) {
        if (c.status === 'departed') return false;
        const lastTime = c.updated_at
          ? new Date(c.updated_at).getTime()
          : new Date(c.checked_at).getTime();
        if (now - lastTime < STALE_MS) return false;
      }
      return true;
    });
  }, [checks, vendorFilter, statusFilter, locationFilter, searchQuery, checkerMode]);

  const stats = useMemo(
    () => countByStatus(checks, ['pending', 'loading', 'loaded', 'departed']),
    [checks]
  );

  const statusPills: StatusPill[] = useMemo(() => [
    { key: 'all', count: stats.total, icon: Layers, label: t('all'), bgActive: 'bg-gray-700', bgInactive: 'bg-gray-100', textInactive: 'text-gray-600' },
    { key: 'pending', count: stats.pending || 0, icon: Clock, label: t('cc_status_pending'), bgActive: 'bg-amber-500', bgInactive: 'bg-amber-50', textInactive: 'text-amber-700' },
    { key: 'loading', count: stats.loading || 0, icon: CircleAlert, label: t('cc_status_loading'), bgActive: 'bg-blue-500', bgInactive: 'bg-blue-50', textInactive: 'text-blue-700' },
    { key: 'loaded', count: stats.loaded || 0, icon: CheckCircle2, label: t('cc_status_loaded'), bgActive: 'bg-emerald-500', bgInactive: 'bg-emerald-50', textInactive: 'text-emerald-700' },
    { key: 'departed', count: stats.departed || 0, icon: Truck, label: t('cc_status_departed'), bgActive: 'bg-slate-600', bgInactive: 'bg-slate-50', textInactive: 'text-slate-600' },
  ], [stats, t]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return t('cc_status_pending');
      case 'loading': return t('cc_status_loading');
      case 'loaded': return t('cc_status_loaded');
      case 'departed': return t('cc_status_departed');
      default: return status;
    }
  };

  const getLocationLabel = (location: string, dock_no: string | null) => {
    if (location === 'dock' && dock_no) return `${t('cc_location_dock')} ${dock_no}`;
    if (location === 'dock') return t('cc_location_dock');
    return t('cc_location_yard');
  };

  const handleCopyReport = async () => {
    const grouped: Record<string, typeof checks> = {
      loaded: [],
      loading: [],
      pending: [],
    };
    filteredChecks.forEach((c) => {
      if (c.status !== 'departed' && grouped[c.status]) grouped[c.status].push(c);
    });

    const formatLine = (c: ContainerCheck) => {
      let line = `- ${c.container_no}`;
      if (c.vendor) line += ` (${c.vendor})`;
      if (c.status === 'loading' && c.dock_no) line += ` > ${c.dock_no}`;
      return line;
    };

    const sections: string[] = [];
    if (grouped.loaded.length > 0) {
      sections.push(`Loaded/Ready:\n${grouped.loaded.map(formatLine).join('\n')}`);
    }
    if (grouped.loading.length > 0) {
      sections.push(`Loading:\n${grouped.loading.map(formatLine).join('\n')}`);
    }
    if (grouped.pending.length > 0) {
      sections.push(`Pending:\n${grouped.pending.map(formatLine).join('\n')}`);
    }

    const report = `[UPDATE] Container status.\n${sections.join('\n\n')}`;

    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden bg-background h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-border">
        <div className="flex items-center justify-between px-3 py-2.5">
          <h1 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-600" />
            {t('cc_summary')}
          </h1>
          <a href="/containercheck">
            <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium flex items-center gap-1.5 text-gray-700">
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('back')}
            </button>
          </a>
        </div>

        {/* Filters */}
        <div className="px-3 py-2.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('search_placeholder')}
            />
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onReset={() => { setStartDate(getBangkokDateString(-7)); setEndDate(getBangkokDateString()); }}
            />
          </div>

          <StatusFilterPills
            pills={statusPills}
            activeKey={statusFilter}
            onSelect={(key) => setStatusFilter(key as ContainerCheckStatus | 'all')}
          />

          <div className="flex gap-2">
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value as ContainerCheckVendor | 'all')}
              className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">{t('cc_all_vendors')}</option>
              {CC_VENDORS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value as ContainerCheckLocation | 'all')}
              className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">{t('cc_all_locations')}</option>
              <option value="yard">{t('cc_location_yard')}</option>
              <option value="dock">{t('cc_location_dock')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 px-3 py-2 overflow-hidden min-h-0">
        <div className="bg-white rounded-lg shadow-sm h-full flex flex-col border border-gray-200">
          <div className="px-3 py-1.5 border-b border-gray-100 shrink-0 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {t('all')}: <span className="font-medium text-gray-700">{filteredChecks.length}</span> / {stats.total}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const next = !checkerMode;
                  setCheckerMode(next);
                  localStorage.setItem('cc_checker_mode', next ? '1' : '0');
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  checkerMode
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                }`}
              >
                <ScanEye className="w-3 h-3" />
                {t('cc_checker_mode')}
              </button>
              <button
                onClick={handleCopyReport}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  copied
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                }`}
              >
                {copied ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
            </div>
          ) : filteredChecks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
              {t('cc_no_records')}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {filteredChecks.map((check) => {
                const badge = getCCStatusColor(check.status);
                return (
                  <div
                    key={check.id}
                    onClick={checkerMode ? () => setActionCheck(check) : undefined}
                    className={`px-3 py-2.5 border-l-[3px] ${badge.border} ${checkerMode ? 'cursor-pointer active:bg-gray-50' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="font-mono text-sm font-medium text-gray-900 truncate">
                          {check.container_no}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${badge.bg}`}>
                          {getStatusLabel(check.status)}
                        </span>
                      </div>
                      <button
                        onClick={() => setActionCheck(actionCheck?.id === check.id ? null : check)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0 ml-2"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getVendorColor(check.vendor)}`}>
                          {check.vendor}
                        </span>
                        <span className="text-gray-500 flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {getLocationLabel(check.location, check.dock_no)}
                        </span>
                        {check.remark && (
                          <span className="text-gray-400 truncate max-w-20" title={check.remark}>
                            {check.remark}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        {(() => {
                          const timeline = buildTimeline(check.history, check.checked_at);
                          if (timeline.length === 0) return null;
                          const first = timeline[0];
                          const last = timeline[timeline.length - 1];
                          if (timeline.length === 1) {
                            return (
                              <span className="text-[10px] text-gray-400">
                                {actionIcon(first.action)} {getRelativeTime(first.at, true)}
                              </span>
                            );
                          }
                          return (
                            <span className="text-[10px] flex items-center gap-0.5 justify-end">
                              <span className="text-gray-400">{getRelativeTime(first.at, true)}</span>
                              <span className="text-gray-300">&rarr;</span>
                              <span className={actionColor(last.action)}>
                                {actionIcon(last.action)} {getRelativeTime(last.at, true)}
                              </span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Action Menu (BottomSheet) */}
      <BottomSheet
        isOpen={!!actionCheck}
        onClose={() => setActionCheck(null)}
        title={actionCheck ? (
          <>
            <p className="font-mono text-sm font-medium text-gray-900">{actionCheck.container_no}</p>
            <p className="text-[10px] text-gray-400">{actionCheck.id} &middot; {getStatusLabel(actionCheck.status)}</p>
            {actionCheck.remark && <p className="text-[10px] text-gray-500 mt-0.5">{actionCheck.remark}</p>}
          </>
        ) : undefined}
        cancelLabel={t('cancel')}
      >
        {actionCheck && (
          <>
            <a
              href={`/containercheck?edit=${actionCheck.id}&container_no=${actionCheck.container_no}&vendor=${actionCheck.vendor}&location=${actionCheck.location}&dock_no=${actionCheck.dock_no || ''}&status=${actionCheck.status}&remark=${encodeURIComponent(actionCheck.remark || '')}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Edit3 className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-gray-700">{t('edit')}</span>
            </a>

            {actionCheck.status !== 'departed' && (
              <button
                onClick={() => {
                  setDepartingCheck(actionCheck);
                  setShowDepartedModal(true);
                  setActionCheck(null);
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors w-full text-left"
              >
                <LogOut className="w-4 h-4 text-slate-600" />
                <span className="text-sm text-gray-700">{t('cc_status_departed')}</span>
              </button>
            )}

            <button
              onClick={() => {
                setDeletingCheck(actionCheck);
                setShowDeleteModal(true);
                setActionCheck(null);
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 transition-colors w-full text-left"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">{t('delete')}</span>
            </button>
          </>
        )}
      </BottomSheet>

      {/* Departed Confirmation Modal */}
      {showDepartedModal && departingCheck && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs">
            <div className="p-4 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <LogOut className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('cc_confirm_departed')}</h3>
              <p className="font-mono text-xs text-gray-600">{departingCheck.container_no}</p>
              <p className="text-[10px] text-gray-400 mt-1">{t('cc_confirm_departed_desc')}</p>
            </div>
            <div className="flex gap-2 p-3 border-t">
              <button
                onClick={() => { setShowDepartedModal(false); setDepartingCheck(null); }}
                className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-xs"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirmDeparted}
                disabled={actionLoading}
                className="flex-1 py-1.5 bg-slate-600 hover:bg-slate-700 disabled:bg-gray-300 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                {actionLoading ? '...' : t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingCheck && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs">
            <div className="p-4 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('confirm_delete')}</h3>
              <p className="font-mono text-xs text-gray-600">{deletingCheck.container_no}</p>
              <p className="text-[10px] text-gray-400 mt-1">{deletingCheck.id}</p>
            </div>
            <div className="flex gap-2 p-3 border-t">
              <button
                onClick={() => { setShowDeleteModal(false); setDeletingCheck(null); }}
                className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-xs"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {actionLoading ? '...' : t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
