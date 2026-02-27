'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import type { IShipmentBooking } from '@/types';

function nowStr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "dd/mm/yyyy H:mm" → "HH:mm" */
function toInputTime(ts: string): string {
  const timePart = ts.split(' ')[1] || '';
  const [h, m] = timePart.split(':');
  if (h === undefined || m === undefined) return '';
  return `${String(+h).padStart(2, '0')}:${m}`;
}

/** datePart + "HH:mm" → "dd/mm/yyyy H:mm" */
function fromInputTime(datePart: string, inputTime: string): string {
  const [h, m] = inputTime.split(':');
  return `${datePart} ${+h}:${m}`;
}

/** "dd/mm/yyyy H:mm" → "yyyy-mm-dd" (for <input type="date">) */
function toInputDate(ts: string): string {
  const [dd, mm, yyyy] = (ts.split(' ')[0] || '').split('/');
  if (!dd || !mm || !yyyy) return '';
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

type TimeField = 'loading_start' | 'loading_end' | 'arrival_branch' | 'departure_branch' | 'return_dc';

export default function DriverUpdateTimePage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [booking, setBooking] = useState<IShipmentBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<TimeField | 'dock_number' | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

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
    const prev = booking;
    setSavingField(field);
    setBooking((p) => p ? { ...p, [field]: value } : p);
    try {
      const res = await fetch(`/api/shipment-bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const json = await res.json();
      if (json.success) {
        setBooking(json.data);
        setFlash(t('time_updated'));
        setTimeout(() => setFlash(null), 1500);
      } else {
        setBooking(prev);
      }
    } catch {
      setBooking(prev);
    } finally {
      setSavingField(null);
    }
  }

  function handleStamp(field: TimeField) {
    saveField(field, nowStr());
  }

  function handleTimeChange(field: TimeField, inputVal: string) {
    if (!booking || !booking[field] || !inputVal) return;
    const datePart = booking[field].split(' ')[0] || '';
    saveField(field, fromInputTime(datePart, inputVal));
  }

  function handleDateChange(field: TimeField, dateInput: string) {
    if (!booking || !booking[field] || !dateInput) return;
    const [yyyy, mm, dd] = dateInput.split('-');
    const timePart = booking[field].split(' ')[1] || '0:00';
    const newTs = `${dd}/${mm}/${yyyy} ${timePart}`;
    setBooking((p) => p ? { ...p, [field]: newTs } : p);
    saveField(field, newTs);
  }

  async function saveDock(value: string) {
    const prev = booking;
    setSavingField('dock_number');
    setBooking((p) => p ? { ...p, dock_number: value } : p);
    try {
      const res = await fetch(`/api/shipment-bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dock_number: value }),
      });
      const json = await res.json();
      if (json.success) {
        setBooking(json.data);
        setFlash(t('time_updated'));
        setTimeout(() => setFlash(null), 1500);
      } else { setBooking(prev); }
    } catch { setBooking(prev); }
    finally { setSavingField(null); }
  }

  const handleBack = () => router.push('/driver');

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-4 pt-6 pb-10">
        <div className="h-5 w-32 bg-gray-200 rounded-lg mb-4 animate-pulse" />
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3 animate-pulse">
          <div className="h-5 w-40 bg-gray-200 rounded-lg mb-2" />
          <div className="flex gap-2">
            <div className="h-6 w-24 bg-gray-100 rounded-lg" />
            <div className="h-6 w-28 bg-gray-100 rounded-lg" />
          </div>
        </div>
        <div className="flex gap-1 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-1 h-2 bg-gray-200 rounded-full" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 p-4 mb-2 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-gray-100 rounded-lg" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
            <div className="h-11 bg-gray-100 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-md mx-auto p-4 pt-10 text-center">
        <div className="text-gray-400 text-sm mb-4">{t('no_data')}</div>
        <button onClick={handleBack} className="text-emerald-600 text-sm font-medium">
          ← {t('back_to_list')}
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
    ringColor: string;
    icon: string;
  }[] = [
    { key: 'loading_start',    label: t('loading_start'),    stepLabel: t('step_loading'),       color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', barColor: 'bg-indigo-500', ringColor: 'ring-indigo-300', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { key: 'loading_end',      label: t('loading_end'),      stepLabel: t('step_loading_end'),   color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', barColor: 'bg-orange-500', ringColor: 'ring-orange-300', icon: 'M5 13l4 4L19 7' },
    { key: 'arrival_branch',   label: t('arrival_branch'),   stepLabel: t('step_at_branch'),     color: 'text-green-700',  bgColor: 'bg-green-50',  borderColor: 'border-green-200',  barColor: 'bg-green-500',  ringColor: 'ring-green-300',  icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
    { key: 'departure_branch', label: t('departure_branch'), stepLabel: t('step_depart_branch'), color: 'text-teal-700',   bgColor: 'bg-teal-50',   borderColor: 'border-teal-200',   barColor: 'bg-teal-500',   ringColor: 'ring-teal-300',   icon: 'M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z' },
    { key: 'return_dc',        label: t('return_dc'),        stepLabel: t('step_return'),        color: 'text-gray-700',   bgColor: 'bg-gray-100',  borderColor: 'border-gray-300',   barColor: 'bg-gray-600',   ringColor: 'ring-gray-300',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
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
        {t('back_to_list')}
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
          {booking.truck_plate_head && (
            <span className="font-mono font-bold bg-gray-100 px-2.5 py-0.5 rounded-lg text-gray-800">{booking.truck_plate_head}</span>
          )}
          <span className="text-gray-700 font-medium">{booking.destination_branch}</span>
          <span className="text-gray-400 text-xs">{booking.pickup_date}</span>
        </div>
        {/* Dock number input */}
        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-gray-500 font-medium shrink-0">{t('dock_number')}:</label>
          <input
            type="text"
            value={booking.dock_number || ''}
            onChange={(e) => setBooking((p) => p ? { ...p, dock_number: e.target.value } : p)}
            onBlur={(e) => saveDock(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            placeholder={t('dock_placeholder')}
            disabled={savingField === 'dock_number'}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-indigo-700 bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-20 text-center disabled:opacity-50"
          />
          {savingField === 'dock_number' && (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-500" />
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1 flex-1">
          {timeFields.map(({ key, barColor }) => (
            <div key={key} className={`flex-1 h-2 rounded-full transition-colors ${booking[key] ? barColor : 'bg-gray-200'}`} />
          ))}
        </div>
        <span className="text-xs text-gray-400 font-medium tabular-nums shrink-0">{filledCount}/{timeFields.length}</span>
      </div>

      {/* Flash */}
      {flash && (
        <div className="mb-3 text-xs rounded-lg px-3 py-2 flex items-center gap-1.5 bg-green-50 text-green-700">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {flash}
        </div>
      )}

      {/* Time Stamp Fields */}
      <div className="space-y-2">
        {timeFields.map(({ key, label, stepLabel, color, bgColor, borderColor, ringColor, icon }, idx) => {
          const value = booking[key];
          const hasValue = !!value;
          const timeOnly = value ? (value.split(' ')[1] || value) : null;
          const isCurrentStep = !hasValue && timeFields.slice(0, idx).every(({ key: k }) => !!booking[k]);
          const isSaving = savingField === key;

          return (
            <div
              key={key}
              className={`rounded-2xl border p-3.5 transition-all ${
                hasValue
                  ? `${bgColor} ${borderColor}`
                  : isCurrentStep
                    ? 'bg-white border-emerald-300 shadow-sm ring-1 ring-emerald-100'
                    : 'bg-white border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    hasValue ? bgColor : isCurrentStep ? 'bg-emerald-50' : 'bg-gray-50'
                  }`}>
                    {hasValue ? (
                      <svg className={`h-4 w-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className={`h-4 w-4 ${isCurrentStep ? 'text-emerald-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  disabled={!!savingField}
                  className={`w-full rounded-xl py-3.5 text-sm font-bold active:scale-[0.98] transition-all disabled:opacity-50 select-none flex items-center justify-center gap-2 ${
                    isCurrentStep
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                >
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {t('stamp_now')}
                </button>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={toInputDate(value)}
                      onChange={(e) => handleDateChange(key, e.target.value)}
                      disabled={isSaving}
                      className={`flex-1 rounded-xl border bg-white px-2.5 py-2.5 text-sm font-mono font-medium text-gray-800 focus:outline-none focus:ring-2 ${ringColor} transition-all disabled:opacity-50 ${borderColor}`}
                    />
                    <input
                      type="time"
                      value={toInputTime(value)}
                      onChange={(e) => handleTimeChange(key, e.target.value)}
                      disabled={isSaving}
                      className={`rounded-xl border bg-white px-2.5 py-2.5 text-sm font-mono font-medium text-gray-800 focus:outline-none focus:ring-2 ${ringColor} transition-all disabled:opacity-50 ${borderColor}`}
                      style={{ width: '7rem' }}
                    />
                    <button
                      onClick={() => handleStamp(key)}
                      disabled={!!savingField}
                      className="shrink-0 px-2.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-40 flex items-center gap-1"
                    >
                      {isSaving ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400" />
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                      {t('stamp_now')}
                    </button>
                  </div>
                  {isSaving && (
                    <div className="text-[10px] text-gray-400 text-right">{t('saving')}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scan DC CTA — appears after loading_end is filled (get document before departure) */}
      {booking.loading_end && !booking.matched_do_id && (
        <div className="mt-4">
          <button
            onClick={() => router.push('/driver?tab=scan_dc')}
            className="w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t('scan_dc_to_complete')} →
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-1">{t('scan_dc_complete_desc')}</p>
        </div>
      )}

      {/* All Done */}
      {allDone && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-2xl text-sm font-semibold">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('all_times_recorded')}
          </div>
          <button
            onClick={handleBack}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            ← {t('back_to_list')}
          </button>
        </div>
      )}
    </div>
  );
}
