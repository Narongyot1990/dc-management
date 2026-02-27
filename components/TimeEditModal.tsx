'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { IShipmentBooking } from '@/types';

// ─── format helpers ──────────────────────────────────────────────────────────

/** Current time → "dd/mm/yyyy H:mm" */
function nowStr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "dd/mm/yyyy H:mm" → "HH:mm" (for <input type="time">) */
function toInputTime(ts: string): string {
  const timePart = ts.split(' ')[1] || '';
  const [h, m] = timePart.split(':');
  if (h === undefined || m === undefined) return '';
  return `${String(+h).padStart(2, '0')}:${m}`;
}

/** datePart "dd/mm/yyyy" + input "HH:mm" → "dd/mm/yyyy H:mm" */
function fromInputTime(datePart: string, inputTime: string): string {
  const [h, m] = inputTime.split(':');
  return `${datePart} ${+h}:${m}`;
}

/** "dd/mm/yyyy H:mm" → date part */
function datePart(ts: string): string {
  return ts.split(' ')[0] || '';
}

/** "dd/mm/yyyy H:mm" → "yyyy-mm-dd" (for <input type="date">) */
function toInputDate(ts: string): string {
  const [dd, mm, yyyy] = (ts.split(' ')[0] || '').split('/');
  if (!dd || !mm || !yyyy) return '';
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// ─── field definitions ───────────────────────────────────────────────────────

type TimeField =
  | 'loading_start'
  | 'loading_end'
  | 'arrival_branch'
  | 'departure_branch'
  | 'return_dc';

interface FieldDef {
  key: TimeField;
  labelKey: string;
  accent: string;   // Tailwind color class for dot + outline
  dotColor: string; // progress bar
}

const FIELDS: FieldDef[] = [
  { key: 'loading_start',    labelKey: 'loading_start',    accent: 'indigo', dotColor: 'bg-indigo-500' },
  { key: 'loading_end',      labelKey: 'loading_end',      accent: 'orange', dotColor: 'bg-orange-500' },
  { key: 'arrival_branch',   labelKey: 'arrival_branch',   accent: 'green',  dotColor: 'bg-green-500' },
  { key: 'departure_branch', labelKey: 'departure_branch', accent: 'teal',   dotColor: 'bg-teal-500' },
  { key: 'return_dc',        labelKey: 'return_dc',        accent: 'slate',  dotColor: 'bg-slate-500' },
];

// accent → Tailwind classes map (no dynamic class generation)
const ACCENT: Record<string, { ring: string; text: string; bg: string; border: string; badgeBg: string; badgeText: string }> = {
  blue:   { ring: 'ring-blue-300',   text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   badgeBg: 'bg-blue-100',   badgeText: 'text-blue-700' },
  indigo: { ring: 'ring-indigo-300', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-700' },
  orange: { ring: 'ring-orange-300', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', badgeBg: 'bg-orange-100', badgeText: 'text-orange-700' },
  green:  { ring: 'ring-green-300',  text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  badgeBg: 'bg-green-100',  badgeText: 'text-green-700' },
  teal:   { ring: 'ring-teal-300',   text: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-200',   badgeBg: 'bg-teal-100',   badgeText: 'text-teal-700' },
  slate:  { ring: 'ring-slate-300',  text: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200',  badgeBg: 'bg-slate-100',  badgeText: 'text-slate-700' },
};

// ─── props ───────────────────────────────────────────────────────────────────

interface Props {
  bookingId: string | null;
  onClose: (updated: boolean) => void;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function TimeEditModal({ bookingId, onClose }: Props) {
  const { t } = useLanguage();
  const [booking, setBooking]     = useState<IShipmentBooking | null>(null);
  const [loadingData, setLoading] = useState(false);
  const [savingField, setSavingField] = useState<TimeField | null>(null);
  const [flash, setFlash]         = useState<string | null>(null);
  const wasUpdated                = useRef(false);
  const flashTimer                = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchBooking = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/shipment-bookings/${id}`);
      const j = await r.json();
      if (j.success) setBooking(j.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (bookingId) { wasUpdated.current = false; fetchBooking(bookingId); }
    else setBooking(null);
  }, [bookingId, fetchBooking]);

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(wasUpdated.current); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // ── flash ────────────────────────────────────────────────────────────────
  function showFlash() {
    setFlash(t('time_updated'));
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1500);
  }

  // ── save ─────────────────────────────────────────────────────────────────
  async function saveField(field: TimeField, value: string) {
    if (!bookingId) return;
    setSavingField(field);
    try {
      const r = await fetch(`/api/shipment-bookings/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const j = await r.json();
      if (j.success) {
        setBooking(j.data);
        wasUpdated.current = true;
        showFlash();
      }
    } catch { /* silent */ }
    finally { setSavingField(null); }
  }

  // ── stamp now ─────────────────────────────────────────────────────────────
  function handleStamp(field: TimeField) {
    const ts = nowStr();
    setBooking((p) => p ? { ...p, [field]: ts } : p);
    saveField(field, ts);
  }

  // ── time input change ────────────────────────────────────────────────────
  function handleTimeChange(field: TimeField, inputVal: string) {
    if (!booking || !booking[field] || !inputVal) return;
    const newTs = fromInputTime(datePart(booking[field]), inputVal);
    setBooking((p) => p ? { ...p, [field]: newTs } : p);
    saveField(field, newTs);
  }

  // ── date input change ────────────────────────────────────────────────────
  function handleDateChange(field: TimeField, dateInput: string) {
    if (!booking || !booking[field] || !dateInput) return;
    const [yyyy, mm, dd] = dateInput.split('-');
    const timePart = booking[field].split(' ')[1] || '0:00';
    const newTs = `${dd}/${mm}/${yyyy} ${timePart}`;
    setBooking((p) => p ? { ...p, [field]: newTs } : p);
    saveField(field, newTs);
  }

  if (!bookingId) return null;

  const filledCount = FIELDS.filter(({ key }) => !!booking?.[key]).length;
  const allDone = filledCount === FIELDS.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(wasUpdated.current); }}
    >
      <div className="bg-white w-full max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[94dvh]">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-3">
              <h2 className="text-base font-bold text-gray-900">{t('update_time')}</h2>
              {booking && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-gray-500">{booking.destination_branch}</span>
                  {booking.truck_plate_head && (
                    <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                      {booking.truck_plate_head}
                    </span>
                  )}
                  {booking.dock_number && (
                    <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-lg">
                      {t('dock_number_short')} {booking.dock_number}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{booking.pickup_date}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => onClose(wasUpdated.current)}
              className="shrink-0 p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress dots */}
          {booking && (
            <div className="flex items-center gap-1.5 mt-3">
              {FIELDS.map(({ key, dotColor }) => (
                <div
                  key={key}
                  className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${booking[key] ? dotColor : 'bg-gray-200'}`}
                />
              ))}
              <span className="text-xs text-gray-400 ml-1 shrink-0">{filledCount}/{FIELDS.length}</span>
            </div>
          )}

          {/* Flash */}
          {flash && (
            <div className="mt-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {flash}
            </div>
          )}
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2.5">
          {loadingData ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-purple-600" />
            </div>
          ) : !booking ? (
            <div className="text-center py-10 text-gray-400 text-sm">ไม่พบข้อมูล</div>
          ) : (
            FIELDS.map(({ key, labelKey, accent }) => {
              const val      = booking[key];
              const hasValue = !!val;
              const ac       = ACCENT[accent];
              const isSaving = savingField === key;
              const inputVal = hasValue ? toInputTime(val) : '';

              return (
                <div
                  key={key}
                  className={`rounded-2xl border transition-all ${
                    hasValue ? `${ac.bg} ${ac.border}` : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  {/* Field header */}
                  <div className="flex items-center justify-between px-4 pt-3.5 pb-0">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${hasValue ? ac.text : 'text-gray-400'}`}>
                      {t(labelKey)}
                    </span>
                    {hasValue && (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ac.badgeBg} ${ac.badgeText}`}>
                        ✓
                      </span>
                    )}
                  </div>

                  <div className="px-4 pb-3.5 pt-2">
                    {!hasValue ? (
                      /* ── Empty: big stamp button ─ */
                      <button
                        onClick={() => handleStamp(key)}
                        disabled={isSaving}
                        className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-xl py-3.5 text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {isSaving ? '...' : t('stamp_now')}
                      </button>
                    ) : (
                      /* ── Has value: full datetime + time input ─ */
                      <div className="space-y-2">
                        {/* Full datetime display */}
                        <div className={`text-2xl font-bold font-mono tabular-nums ${ac.text}`}>
                          {val.split(' ')[1] || val}
                        </div>
                        <div className="text-[11px] text-gray-400 -mt-1">{val.split(' ')[0]}</div>

                        {/* Date + Time input row */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="date"
                            value={toInputDate(val)}
                            onChange={(e) => handleDateChange(key, e.target.value)}
                            disabled={isSaving}
                            className={`flex-1 rounded-xl border bg-white px-3 py-2.5 text-sm font-mono font-medium text-gray-800
                              focus:outline-none focus:ring-2 ${ac.ring} transition-all disabled:opacity-50
                              ${ac.border}`}
                          />
                          <input
                            type="time"
                            value={inputVal}
                            onChange={(e) => handleTimeChange(key, e.target.value)}
                            disabled={isSaving}
                            className={`rounded-xl border bg-white px-3 py-2.5 text-sm font-mono font-medium text-gray-800
                              focus:outline-none focus:ring-2 ${ac.ring} transition-all disabled:opacity-50
                              ${ac.border}`}
                            style={{ width: '7.5rem' }}
                          />
                          {/* Re-stamp button */}
                          <button
                            onClick={() => handleStamp(key)}
                            disabled={isSaving}
                            className="shrink-0 px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-40 flex items-center gap-1"
                            title="บันทึกเวลาตอนนี้ใหม่"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            ตอนนี้
                          </button>
                        </div>
                        {/* Saving indicator */}
                        {isSaving && (
                          <div className="text-[10px] text-gray-400 text-right">กำลังบันทึก...</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        {allDone && (
          <div className="px-5 py-4 border-t border-gray-100 shrink-0">
            <div className="flex items-center justify-center gap-2 bg-green-50 text-green-700 rounded-2xl py-3 text-sm font-semibold">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('all_times_recorded')}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
