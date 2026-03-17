'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/contexts/LanguageContext';
import type { IDeliveryOrder, IShipmentBooking } from '@/types';
import type { BranchData, MapFilter } from '@/components/MapView';
import branchesRaw from '@/data/branches.json';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

const branches: BranchData[] = branchesRaw as BranchData[];

function getTodayStr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toInputDate(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  if (!dd || !mm || !yyyy) return '';
  return `${yyyy}-${mm}-${dd}`;
}

function fromInputDate(ymd: string): string {
  const [yyyy, mm, dd] = ymd.split('-');
  if (!dd || !mm || !yyyy) return '';
  return `${dd}/${mm}/${yyyy}`;
}

function matchBranch(dest: string): BranchData | undefined {
  if (!dest) return undefined;
  const byCode = branches.find((b) => b.code.toLowerCase() === dest.toLowerCase());
  if (byCode) return byCode;
  const codeMatch = dest.match(/\[([A-Z0-9]+)\]/i);
  if (codeMatch) {
    const found = branches.find((b) => b.code.toLowerCase() === codeMatch[1].toLowerCase());
    if (found) return found;
  }
  return branches.find((b) => b.name && (b.name === dest || dest.includes(b.name) || b.name.includes(dest)));
}

function getBookingStatus(b: IShipmentBooking): 'waiting' | 'loading' | 'enroute' | 'done' {
  if (b.status === 'fulfilled') return 'done';
  if (b.loading_end) return 'enroute';
  // Only show 'loading' if both loading_start AND dock_number are set
  if (b.loading_start && b.dock_number) return 'loading';
  return 'waiting';
}

function MapContent() {
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [records, setRecords] = useState<IDeliveryOrder[]>([]);
  const [bookings, setBookings] = useState<IShipmentBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MapFilter>('all');

  useEffect(() => {
    if (!selectedDate) return;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [doRes, bkRes] = await Promise.all([
          fetch(`/api/delivery-orders?document_date=${encodeURIComponent(selectedDate)}&limit=200`),
          fetch(`/api/shipment-bookings?pickup_date=${encodeURIComponent(selectedDate)}`),
        ]);
        const doJson = await doRes.json();
        const bkJson = await bkRes.json();
        if (doJson.success) {
          setRecords(doJson.data || []);
        } else {
          setError(doJson.error || 'Failed to load');
        }
        if (bkJson.success) {
          setBookings(bkJson.data || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedDate]);

  // Compute stats
  const stats = useMemo(() => {
    let matchedCount = 0;
    let unmatchedCount = 0;
    for (const rec of records) {
      if (matchBranch(rec.destination_branch?.trim() || '')) matchedCount++;
      else unmatchedCount++;
    }

    let waitingCount = 0;
    let loadingCount = 0;
    let enrouteCount = 0;
    let doneCount = 0;
    for (const bk of bookings) {
      const st = getBookingStatus(bk);
      if (st === 'waiting') waitingCount++;
      else if (st === 'loading') loadingCount++;
      else if (st === 'enroute') enrouteCount++;
      else doneCount++;
    }

    return { matchedCount, unmatchedCount, waitingCount, loadingCount, enrouteCount, doneCount };
  }, [records, bookings]);

  const filterButtons: { key: MapFilter; label: string; count: number; color: string; bg: string; border: string }[] = [
    { key: 'all',     label: t('map_filter_all'),     count: records.length + bookings.length, color: 'text-gray-700',  bg: 'bg-white',    border: 'border-gray-200' },
    { key: 'do',      label: t('map_filter_do'),      count: records.length,                    color: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-200' },
    { key: 'draft',   label: t('map_filter_draft'),   count: stats.waitingCount,                color: 'text-gray-600',  bg: 'bg-gray-50',  border: 'border-gray-200' },
    { key: 'loading', label: t('map_filter_loading'), count: stats.loadingCount + stats.waitingCount, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    { key: 'enroute', label: t('map_filter_enroute'), count: stats.enrouteCount,                color: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-200' },
    { key: 'done',    label: t('map_filter_done'),    count: stats.doneCount,                   color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-6xl mx-auto space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-gray-800">{t('map_title')}</h1>
              <p className="text-xs text-gray-500">{t('map_subtitle')}</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Date picker */}
              <input
                type="date"
                value={toInputDate(selectedDate)}
                onChange={(e) => { setSelectedDate(fromInputDate(e.target.value)); setFilter('all'); }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Quick stats */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium">
                  {records.length} DO
                </span>
                {stats.matchedCount > 0 && (
                  <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md font-medium">
                    {stats.matchedCount} {t('matched')}
                  </span>
                )}
                {stats.unmatchedCount > 0 && (
                  <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium">
                    {stats.unmatchedCount} {t('unmatched')}
                  </span>
                )}
                {bookings.length > 0 && (
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-medium">
                    {bookings.length} {t('draft_count')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {filterButtons.map((btn) => {
              const isActive = filter === btn.key;
              return (
                <button
                  key={btn.key}
                  onClick={() => setFilter(filter === btn.key && btn.key !== 'all' ? 'all' : btn.key)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all select-none ${
                    isActive
                      ? `${btn.bg} ${btn.border} ${btn.color} ring-2 ring-offset-1 ring-blue-300 shadow-sm`
                      : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className={`font-bold ${isActive ? btn.color : 'text-gray-700'}`}>{btn.count}</span>
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 p-2">
        {records.length === 0 && bookings.length === 0 && !loading ? (
          <div className="h-full flex items-center justify-center bg-gray-50 rounded-xl">
            <div className="text-center text-gray-400">
              <MapPinIcon className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('no_data_for_date')}</p>
              <p className="text-xs mt-1">{selectedDate}</p>
            </div>
          </div>
        ) : (
          <MapView records={records} branches={branches} bookings={bookings} loading={loading} filter={filter} />
        )}
      </div>
    </div>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100vh-56px)] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }
    >
      <MapContent />
    </Suspense>
  );
}
