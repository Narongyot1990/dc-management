'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRole } from '@/contexts/RoleContext';
import type { IShipmentBooking } from '@/types';

function nowStr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = d.getHours();
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function parseTimestamp(ts: string): Date | null {
  const m = ts.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
}

function formatTimestamp(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = d.getHours();
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function adjustTime(ts: string, minutes: number): string {
  const d = parseTimestamp(ts);
  if (!d) return ts;
  d.setMinutes(d.getMinutes() + minutes);
  return formatTimestamp(d);
}

type TimeField = 'clock_in' | 'loading_start' | 'loading_end' | 'arrival_branch' | 'departure_branch' | 'return_dc';

export default function UpdateTimePage() {
  const { t } = useLanguage();
  const { role } = useRole();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [booking, setBooking] = useState<IShipmentBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBooking = useCallback(async () => {
    try {
      const res = await fetch(`/api/shipment-bookings/${id}`);
      const json = await res.json();
      if (json.success) setBooking(json.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  async function saveField(field: TimeField, value: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/shipment-bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const json = await res.json();
      if (json.success) {
        setBooking(json.data);
        setMessage({ type: 'success', text: t('time_updated') });
      } else {
        setMessage({ type: 'error', text: json.error || 'Error' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  }

  function handleStamp(field: TimeField) {
    const ts = nowStr();
    setBooking((prev) => prev ? { ...prev, [field]: ts } : prev);
    saveField(field, ts);
  }

  function handleAdjust(field: TimeField, minutes: number) {
    if (!booking || !booking[field]) return;
    const newTs = adjustTime(booking[field], minutes);
    setBooking((prev) => prev ? { ...prev, [field]: newTs } : prev);
    saveField(field, newTs);
  }

  const handleBack = () => {
    if (role === 'driver') {
      router.push('/scan');
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-md mx-auto p-4 pt-10 text-center">
        <div className="text-gray-400 text-sm mb-4">ไม่พบข้อมูล Booking</div>
        <button onClick={handleBack} className="text-purple-600 text-sm font-medium">
          ← {role === 'driver' ? t('driver_scan_title') : t('shipment')}
        </button>
      </div>
    );
  }

  const timeFields: {
    key: TimeField;
    label: string;
    stepLabel: string;
    color: string;
    bgColor: string;
    borderColor: string;
    barColor: string;
    icon: string;
  }[] = [
    { key: 'clock_in',         label: t('clock_in'),         stepLabel: t('step_clock_in'),      color: 'text-blue-700',   bgColor: 'bg-blue-50',   borderColor: 'border-blue-200',   barColor: 'bg-blue-500',   icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'loading_start',    label: t('loading_start'),    stepLabel: t('step_loading'),       color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', barColor: 'bg-indigo-500', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { key: 'loading_end',      label: t('loading_end'),      stepLabel: t('step_depart_dc'),     color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', barColor: 'bg-orange-500', icon: 'M17 8l4 4m0 0l-4 4m4-4H3' },
    { key: 'arrival_branch',   label: t('arrival_branch'),   stepLabel: t('step_at_branch'),     color: 'text-green-700',  bgColor: 'bg-green-50',  borderColor: 'border-green-200',  barColor: 'bg-green-500',  icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
    { key: 'departure_branch', label: t('departure_branch'), stepLabel: t('step_depart_branch'), color: 'text-teal-700',   bgColor: 'bg-teal-50',   borderColor: 'border-teal-200',   barColor: 'bg-teal-500',   icon: 'M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z' },
    { key: 'return_dc',        label: t('return_dc'),        stepLabel: t('step_return'),        color: 'text-gray-700',   bgColor: 'bg-gray-100',  borderColor: 'border-gray-300',   barColor: 'bg-gray-600',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  ];

  const filledCount = timeFields.filter(({ key }) => !!booking[key]).length;
  const allDone = filledCount === timeFields.length;

  return (
    <div className="max-w-md mx-auto p-4 pt-6 pb-10">
      {/* Back */}
      <button onClick={handleBack} className="text-gray-500 text-sm mb-4 flex items-center gap-1 hover:text-gray-700">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {role === 'driver' ? t('driver_scan_title') : t('shipment')}
      </button>

      {/* Booking Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <h1 className="text-base font-bold text-gray-800">{t('update_time')}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            booking.status === 'fulfilled' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {t(booking.status)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="text-gray-700 font-medium">{booking.destination_branch}</span>
          {booking.truck_plate_head && (
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">{booking.truck_plate_head}</span>
          )}
          <span className="text-gray-400 text-xs">{booking.pickup_date}</span>
        </div>
      </div>

      {/* Progress bar with count */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1 flex-1">
          {timeFields.map(({ key, barColor }) => (
            <div key={key} className={`flex-1 h-2 rounded-full transition-colors ${booking[key] ? barColor : 'bg-gray-200'}`} />
          ))}
        </div>
        <span className="text-xs text-gray-400 font-medium tabular-nums shrink-0">{filledCount}/{timeFields.length}</span>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-3 text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' && (
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {message.text}
        </div>
      )}

      {/* Time Stamp Fields */}
      <div className="space-y-2">
        {timeFields.map(({ key, label, stepLabel, color, bgColor, borderColor, icon }, idx) => {
          const value = booking[key];
          const hasValue = !!value;
          const timeOnly = value ? (value.split(' ')[1] || value) : null;
          // Highlight current step (first empty field)
          const isCurrentStep = !hasValue && timeFields.slice(0, idx).every(({ key: k }) => !!booking[k]);

          return (
            <div
              key={key}
              className={`rounded-2xl border p-3.5 transition-all ${
                hasValue
                  ? `${bgColor} ${borderColor}`
                  : isCurrentStep
                    ? 'bg-white border-purple-300 shadow-sm ring-1 ring-purple-100'
                    : 'bg-white border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    hasValue ? bgColor : isCurrentStep ? 'bg-purple-50' : 'bg-gray-50'
                  }`}>
                    {hasValue ? (
                      <svg className={`h-4 w-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className={`h-4 w-4 ${isCurrentStep ? 'text-purple-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className={`text-sm font-semibold ${hasValue ? color : isCurrentStep ? 'text-gray-800' : 'text-gray-500'}`}>{label}</span>
                    {!hasValue && (
                      <div className="text-[10px] text-gray-400">{stepLabel}</div>
                    )}
                  </div>
                </div>
                {hasValue && (
                  <span className={`text-xl font-mono font-bold tabular-nums ${color}`}>{timeOnly}</span>
                )}
              </div>

              {!hasValue ? (
                <button
                  onClick={() => handleStamp(key)}
                  disabled={saving}
                  className={`w-full rounded-xl py-3.5 text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50 select-none ${
                    isCurrentStep
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                >
                  {t('stamp_now')}
                </button>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-center text-[10px] text-gray-400">{value}</div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAdjust(key, -5)}
                      disabled={saving}
                      className="flex-1 bg-white border border-gray-200 rounded-xl py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50 select-none"
                    >
                      -5 {t('minutes')}
                    </button>
                    <button
                      onClick={() => handleStamp(key)}
                      disabled={saving}
                      className="w-10 h-10 bg-white border border-gray-200 rounded-xl text-gray-400 hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center justify-center text-base"
                      title="Reset to now"
                    >
                      ↻
                    </button>
                    <button
                      onClick={() => handleAdjust(key, 5)}
                      disabled={saving}
                      className="flex-1 bg-white border border-gray-200 rounded-xl py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50 select-none"
                    >
                      +5 {t('minutes')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Done */}
      {allDone && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-2xl text-sm font-semibold">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('all_times_recorded')}
          </div>
          {role === 'driver' && (
            <button
              onClick={() => router.push('/scan')}
              className="w-full bg-purple-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-purple-700 active:scale-[0.98] transition-all"
            >
              ← {t('driver_scan_title')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
