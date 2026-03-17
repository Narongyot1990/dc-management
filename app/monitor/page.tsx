'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBookings, invalidateBookingsCache } from '@/hooks/useBookings';
import { useBookingEvents } from '@/hooks/usePusher';
import TimeEditModal from '@/components/TimeEditModal';
import type { IShipmentBooking } from '@/types';

function getTodayStr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
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

function splitTs(ts: string | undefined): { date: string; time: string } | null {
  if (!ts) return null;
  const [date, time] = ts.split(' ');
  if (!date || !time) return null;
  return { date, time };
}

type TimeField = 'loading_start' | 'loading_end' | 'arrival_branch' | 'departure_branch' | 'return_dc';

const TIME_FIELDS: { key: TimeField; labelKey: string }[] = [
  { key: 'loading_start', labelKey: 'loading_start' },
  { key: 'loading_end', labelKey: 'loading_end' },
  { key: 'arrival_branch', labelKey: 'arrival_branch' },
  { key: 'departure_branch', labelKey: 'departure_branch' },
  { key: 'return_dc', labelKey: 'return_dc' },
];

type BookingStatus = 'waiting' | 'loading' | 'enroute' | 'completed';

function getBookingStatus(b: IShipmentBooking): BookingStatus {
  if (b.status === 'fulfilled') return 'completed';
  if (b.loading_end) return 'enroute';
  // Only show 'loading' if both loading_start AND dock_number are set
  if (b.loading_start && b.dock_number) return 'loading';
  return 'waiting';
}

function secondsAgo(ts: number | null): string {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

export default function MonitorPage() {
  const { t } = useLanguage();
  const [date, setDate] = useState(getTodayStr());
  const { bookings, loading, refresh, lastUpdated } = useBookings(date);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [agoText, setAgoText] = useState('');

  // Pusher: auto-refresh on real-time events
  const handlePusherEvent = useCallback(() => {
    invalidateBookingsCache(date);
    refresh();
  }, [date, refresh]);
  useBookingEvents(handlePusherEvent);

  // Update "X sec ago" ticker
  useEffect(() => {
    setAgoText(secondsAgo(lastUpdated));
    const interval = setInterval(() => setAgoText(secondsAgo(lastUpdated)), 5000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  function handleModalClose(updated: boolean) {
    setEditingId(null);
    if (updated) refresh();
  }

  // Stats
  const statusCounts = useMemo(() => {
    const counts = { waiting: 0, loading: 0, enroute: 0, completed: 0 };
    for (const b of bookings) counts[getBookingStatus(b)]++;
    return counts;
  }, [bookings]);

  // Filtered bookings
  const filtered = useMemo(() => {
    let list = bookings;
    if (statusFilter !== 'all') {
      list = list.filter((b) => getBookingStatus(b) === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          (b.truck_plate_head || '').toLowerCase().includes(q) ||
          (b.destination_branch || '').toLowerCase().includes(q) ||
          (b.dock_number || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [bookings, statusFilter, search]);

  const isFiltered = statusFilter !== 'all' || search.trim().length > 0;

  const statsCards: { status: BookingStatus | 'all'; count: number; label: string; bg: string; border: string; text: string; numColor: string }[] = [
    { status: 'all',       count: bookings.length,          label: t('total_trucks'),   bg: 'bg-white',     border: 'border-gray-100', text: 'text-gray-500',  numColor: 'text-gray-800' },
    { status: 'waiting',   count: statusCounts.waiting + statusCounts.loading, label: t('trucks_loading'), bg: 'bg-amber-50',  border: 'border-amber-100', text: 'text-amber-600', numColor: 'text-amber-700' },
    { status: 'enroute',   count: statusCounts.enroute,     label: t('trucks_enroute'), bg: 'bg-blue-50',   border: 'border-blue-100',  text: 'text-blue-600',  numColor: 'text-blue-700' },
    { status: 'completed', count: statusCounts.completed,   label: t('trucks_done'),    bg: 'bg-green-50',  border: 'border-green-100', text: 'text-green-600', numColor: 'text-green-700' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{t('monitor_title')}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-500">{t('monitor_subtitle')}</p>
            {agoText && (
              <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md">
                {agoText}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
            title={t('refresh')}
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <input
            type="date"
            value={toInputDate(date)}
            onChange={(e) => { setDate(fromInputDate(e.target.value)); setStatusFilter('all'); setSearch(''); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <Link href="/plan">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              + {t('plan')}
            </button>
          </Link>
        </div>
      </div>

      {/* Stats Bar — clickable filter */}
      <div className="grid grid-cols-4 gap-3">
        {statsCards.map((card) => {
          const isActive = statusFilter === card.status || (statusFilter === 'all' && card.status === 'all');
          const handleClick = () => {
            if (card.status === 'all') { setStatusFilter('all'); }
            else if (card.status === 'waiting') {
              // "waiting" card includes both waiting + loading
              setStatusFilter(statusFilter === 'waiting' ? 'all' : 'waiting');
            } else {
              setStatusFilter(statusFilter === card.status ? 'all' : card.status);
            }
          };
          return (
            <button
              key={card.status}
              onClick={handleClick}
              className={`rounded-xl border p-3 text-center transition-all cursor-pointer select-none ${card.bg} ${
                isActive && statusFilter !== 'all'
                  ? `${card.border} ring-2 ring-offset-1 ring-blue-300 shadow-sm`
                  : `${card.border} hover:shadow-sm`
              }`}
            >
              <div className={`text-2xl font-bold ${card.numColor}`}>{card.count}</div>
              <div className={`text-xs ${card.text}`}>{card.label}</div>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_monitor')}
            className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400 bg-white"
          />
        </div>
        {isFiltered && (
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {t('showing_filtered').replace('{{count}}', String(filtered.length)).replace('{{total}}', String(bookings.length))}
          </span>
        )}
      </div>

      {/* Time Grid Table */}
      {loading && bookings.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-gray-50 animate-pulse">
                <div className="h-5 w-24 bg-gray-200 rounded-lg" />
                <div className="h-4 w-16 bg-gray-100 rounded" />
                <div className="h-4 w-12 bg-gray-100 rounded" />
                <div className="flex-1 flex gap-3">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <div key={j} className="h-4 w-12 bg-gray-100 rounded" />
                  ))}
                </div>
                <div className="h-5 w-16 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <svg className="h-12 w-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17h.01M16 17h.01M3 13h18M3 13V8a2 2 0 012-2h8l4 4h2a2 2 0 012 2v1M3 13l1 4h1a2 2 0 104 0h6a2 2 0 104 0h1l1-4" />
          </svg>
          <p className="text-gray-400 text-sm">{t('no_bookings')}</p>
          <Link href="/plan" className="text-blue-600 text-sm font-medium mt-2 inline-block hover:text-blue-800">
            + {t('plan')}
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="px-3 py-2.5 text-left font-medium sticky left-0 bg-gray-50 z-10 shadow-[1px_0_0_0_#f3f4f6]">
                    {t('truck_plate_head')}
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('destination_branch')}</th>
                  <th className="px-3 py-2.5 text-center font-medium">{t('dock_number_short')}</th>
                  <th className="px-3 py-2.5 text-center font-medium">{t('pickup_time')}</th>
                  {TIME_FIELDS.map((col) => (
                    <th key={col.key} className="px-3 py-2.5 text-center font-medium whitespace-nowrap">
                      {t(col.labelKey)}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-medium">{t('status')}</th>
                  <th className="px-2 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((b) => {
                  const status = getBookingStatus(b);
                  const allTimeDone = TIME_FIELDS.every(({ key }) => !!b[key]);
                  const rowBg = status === 'completed' ? 'bg-green-50/40' : status === 'enroute' ? 'bg-blue-50/30' : status === 'loading' ? 'bg-amber-50/30' : '';
                  return (
                    <tr key={b._id} className={`hover:bg-gray-50/60 ${rowBg}`}>
                      <td className={`px-3 py-2.5 font-mono font-semibold text-gray-700 sticky left-0 z-10 shadow-[1px_0_0_0_#f3f4f6] ${rowBg || 'bg-white'}`}>
                        {b.truck_plate_head || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{b.destination_branch}</td>
                      <td className="px-3 py-2.5 text-center">
                        {b.dock_number ? (
                          <span className="inline-block bg-indigo-50 text-indigo-700 font-bold text-[11px] px-2 py-0.5 rounded-lg">{b.dock_number}</span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{b.pickup_time || '—'}</td>
                      {TIME_FIELDS.map(({ key }) => {
                        const val = b[key] as string | undefined;
                        const parts = splitTs(val);
                        return (
                          <td key={key} className="px-2 py-1.5 text-center tabular-nums">
                            {parts ? (
                              <div className="leading-tight">
                                <div className="text-[9px] text-gray-400">{parts.date}</div>
                                <div className="text-xs font-semibold text-gray-800">{parts.time}</div>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center">
                        {allTimeDone && b.status === 'fulfilled' ? (
                          <span className="inline-flex items-center gap-0.5 text-green-600 text-[10px] font-medium">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            {t('fulfilled')}
                          </span>
                        ) : (
                          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            status === 'enroute' ? 'bg-blue-100 text-blue-700' :
                            status === 'loading' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {status === 'enroute' ? t('on_route') : status === 'loading' ? t('in_progress') : 'รอโหลดสินค้า'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          onClick={() => setEditingId(b._id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Time Edit Modal */}
      <TimeEditModal bookingId={editingId} onClose={handleModalClose} />
    </div>
  );
}
