'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBookingEvents } from '@/hooks/usePusher';
import CameraCapture from '@/components/CameraCapture';
import DOForm from '@/components/DOForm';
import Alert from '@/components/ui/Alert';
import type { ScanResult, IShipmentBooking } from '@/types';

type Tab = 'trucks' | 'scan_dc';

export default function DriverPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'scan_dc' ? 'scan_dc' : 'trucks';
  const [tab, setTab] = useState<Tab>(initialTab);

  // ── Truck list state ──
  const [manualDate, setManualDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [draftBookings, setDraftBookings] = useState<IShipmentBooking[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [searchPlate, setSearchPlate] = useState('');

  // ── DC Scan state ──
  const [image, setImage] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [matchedBooking, setMatchedBooking] = useState<IShipmentBooking | null>(null);
  const [fulfilling, setFulfilling] = useState(false);

  // Duplicate DC check
  const [duplicate, setDuplicate] = useState<{ id: string; dc_number: string } | null>(null);

  function toDdMmYyyy(inputDate: string): string {
    const [yyyy, mm, dd] = inputDate.split('-');
    if (!yyyy || !mm || !dd) return '';
    return `${dd}/${mm}/${yyyy}`;
  }

  const fetchDraftBookings = useCallback(async (inputDate: string) => {
    setLoadingDrafts(true);
    try {
      const ddmmyyyy = toDdMmYyyy(inputDate);
      const url = ddmmyyyy
        ? `/api/shipment-bookings?pickup_date=${encodeURIComponent(ddmmyyyy)}`
        : '/api/shipment-bookings';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setDraftBookings((data.data as IShipmentBooking[]).filter((b) => b.status === 'draft'));
      }
    } catch { /* silent */ }
    finally { setLoadingDrafts(false); }
  }, []);

  useEffect(() => { fetchDraftBookings(manualDate); }, [manualDate, fetchDraftBookings]);

  // Pusher: auto-refresh on real-time events
  useBookingEvents(useCallback(() => fetchDraftBookings(manualDate), [fetchDraftBookings, manualDate]));

  const filteredDrafts = useMemo(() => {
    if (!searchPlate.trim()) return draftBookings;
    const q = searchPlate.toLowerCase();
    return draftBookings.filter(
      (b) =>
        (b.truck_plate_head || '').toLowerCase().includes(q) ||
        (b.destination_branch || '').toLowerCase().includes(q)
    );
  }, [draftBookings, searchPlate]);

  const getProgress = (b: IShipmentBooking) => {
    const fields = ['loading_start', 'loading_end', 'arrival_branch', 'departure_branch', 'return_dc'] as const;
    return fields.filter((f) => !!b[f]).length;
  };

  // ── DC Scan handlers ──
  const handleImageCapture = (base64: string) => {
    setImage(base64);
    setScanResult(null);
    setError(null);
    setSuccessMsg(null);
    setDuplicate(null);
    setMatchedBooking(null);
  };

  const handleScanDC = async () => {
    if (!image) return;
    setIsScanning(true);
    setError(null);
    setDuplicate(null);
    setMatchedBooking(null);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (data.error && !data.dc_number) { setError(data.error); return; }

      // Check for duplicate DC
      if (data.dc_number) {
        const checkRes = await fetch(`/api/delivery-orders/check-dc?dc=${encodeURIComponent(data.dc_number)}`);
        const checkData = await checkRes.json();
        if (checkData.exists) {
          setScanResult(data);
          setDuplicate({ id: checkData.record._id, dc_number: data.dc_number });
          return;
        }
      }

      setScanResult(data);

      // Try to auto-match by truck plate
      if (data.truck_plate_head) {
        const searchRes = await fetch(`/api/shipment-bookings?truck_plate=${encodeURIComponent(data.truck_plate_head)}`);
        const searchData = await searchRes.json();
        if (searchData.success && searchData.data?.length > 0) {
          const draft = searchData.data.find((b: IShipmentBooking) => b.status === 'draft');
          if (draft) setMatchedBooking(draft);
        }
      }
    } catch {
      setError('Failed to scan document');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!matchedBooking || !scanResult) return;
    setFulfilling(true);
    setError(null);
    try {
      // 1. Save the delivery order
      const doRes = await fetch('/api/delivery-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scanResult, scan_image: image }),
      });
      const doData = await doRes.json();

      // 2. Link DO to booking (keep status as draft — NOT fulfilled yet)
      if (doData.success && doData.data?._id) {
        await fetch(`/api/shipment-bookings/${matchedBooking._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matched_do_id: doData.data._id }),
        });
      }

      setSuccessMsg(t('job_completed'));
      setTimeout(() => {
        handleResetScan();
        setTab('trucks');
        fetchDraftBookings(manualDate);
      }, 1500);
    } catch {
      setError('Failed to save document');
    } finally {
      setFulfilling(false);
    }
  };

  const handleSaveDOOnly = async (formData: Record<string, unknown>) => {
    setError(null);
    try {
      const res = await fetch('/api/delivery-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Failed to save'); return; }
      setSuccessMsg(t('saved_success'));
      setTimeout(() => handleResetScan(), 1500);
    } catch {
      setError('Failed to save record');
    }
  };

  const handleResetScan = () => {
    setImage('');
    setScanResult(null);
    setError(null);
    setSuccessMsg(null);
    setDuplicate(null);
    setMatchedBooking(null);
  };

  // ── RENDER ──
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Title */}
      <div>
        <h1 className="text-lg font-bold text-gray-800">{t('driver_title')}</h1>
        <p className="text-xs text-gray-500">{t('driver_subtitle')}</p>
      </div>

      {/* Tab Toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab('trucks')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'trucks' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h.01M16 17h.01M3 13h18M3 13V8a2 2 0 012-2h8l4 4h2a2 2 0 012 2v1M3 13l1 4h1a2 2 0 104 0h6a2 2 0 104 0h1l1-4" />
          </svg>
          {t('tab_truck_list')}
        </button>
        <button
          onClick={() => setTab('scan_dc')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'scan_dc' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {t('tab_scan_dc')}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: TRUCK LIST                                              */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {tab === 'trucks' && (
        <>
          {/* Date + Search */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1.5">{t('select_date')}</label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => {
                  setManualDate(e.target.value);
                  setSearchPlate('');
                }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            {draftBookings.length > 0 && (
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchPlate}
                  onChange={(e) => setSearchPlate(e.target.value)}
                  placeholder={t('search_plate')}
                  className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 placeholder:text-gray-400"
                />
              </div>
            )}
          </div>

          {/* Truck Cards */}
          {loadingDrafts ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-[90px] bg-gray-200 rounded-xl" />
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                      <div className="h-3 w-20 bg-gray-100 rounded" />
                      <div className="flex gap-0.5 mt-2">
                        {Array.from({ length: 5 }).map((__, j) => (
                          <div key={j} className="flex-1 h-1 bg-gray-200 rounded-full" />
                        ))}
                      </div>
                    </div>
                    <div className="h-5 w-5 bg-gray-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <svg className="h-12 w-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17h.01M16 17h.01M3 13h18M3 13V8a2 2 0 012-2h8l4 4h2a2 2 0 012 2v1M3 13l1 4h1a2 2 0 104 0h6a2 2 0 104 0h1l1-4" />
              </svg>
              <p className="text-gray-400 text-sm">{t('no_bookings')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {t('draft')} ({filteredDrafts.length})
                </span>
              </div>
              {filteredDrafts.map((b) => {
                const progress = getProgress(b);
                const totalSteps = 5;
                return (
                  <button
                    key={b._id}
                    onClick={() => router.push(`/driver/update/${b._id}`)}
                    className="w-full bg-white rounded-2xl border border-gray-100 hover:border-emerald-200 hover:shadow-md p-4 transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        <div className="font-mono font-bold text-base text-gray-800 bg-gray-100 group-hover:bg-emerald-50 px-3 py-2 rounded-xl border border-gray-200 group-hover:border-emerald-200 transition-colors text-center min-w-[90px]">
                          {b.truck_plate_head || '—'}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">{b.destination_branch}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {b.pickup_time && (
                            <span className="text-xs text-gray-500">{b.pickup_time}</span>
                          )}
                          {progress > 0 && (
                            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                              {progress}/{totalSteps}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-0.5 mt-2">
                          {Array.from({ length: totalSteps }).map((_, i) => (
                            <div
                              key={i}
                              className={`flex-1 h-1 rounded-full ${i < progress ? 'bg-emerald-500' : 'bg-gray-200'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <svg className="h-5 w-5 text-gray-300 group-hover:text-emerald-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: SCAN DC                                                 */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {tab === 'scan_dc' && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-emerald-800">{t('scan_dc_to_complete')}</h3>
                <p className="text-xs text-emerald-600 mt-0.5">{t('scan_dc_complete_desc')}</p>
              </div>
            </div>
          </div>

          {error && <Alert variant="error">{error}</Alert>}
          {successMsg && <Alert variant="success">{successMsg}</Alert>}

          {/* Duplicate DC Warning */}
          {duplicate && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <svg className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-amber-800">{t('dc_duplicate_title')}</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    {t('dc_duplicate_msg').replace('{{dc}}', duplicate.dc_number)}
                  </p>
                </div>
              </div>
              <button onClick={handleResetScan} className="w-full bg-amber-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-amber-700 transition-colors">
                {t('retake')}
              </button>
            </div>
          )}

          {/* Camera */}
          {!scanResult && !duplicate && (
            <CameraCapture onImageCapture={handleImageCapture} isScanning={isScanning} onScan={handleScanDC} />
          )}

          {/* Scan Result + Match */}
          {scanResult && !duplicate && (
            <div className="space-y-4">
              {/* Matched Booking → Complete Job */}
              {matchedBooking ? (
                <div className="bg-white rounded-2xl border border-green-200 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-xl px-4 py-2.5">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-semibold">{t('plate_matched')}</span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('truck_plate_head')}</span>
                      <span className="font-mono font-bold text-gray-800">{matchedBooking.truck_plate_head}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('destination_branch')}</span>
                      <span className="font-medium text-gray-800">{matchedBooking.destination_branch}</span>
                    </div>
                    {scanResult.dc_number && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('dc_number')}</span>
                        <span className="font-medium text-gray-800">{scanResult.dc_number}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleCompleteJob}
                    disabled={fulfilling}
                    className="w-full bg-green-600 text-white rounded-xl py-3.5 text-sm font-bold hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {fulfilling ? t('saving') : `${t('confirm_complete')} ✓`}
                  </button>
                  <button onClick={handleResetScan} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1">
                    {t('retake')}
                  </button>
                </div>
              ) : (
                /* No match → show DO form for manual save */
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-4 py-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-sm font-semibold">{t('plate_not_matched')}</span>
                  </div>
                  <DOForm scanResult={scanResult} scanImage={image} onSave={handleSaveDOOnly} onReset={handleResetScan} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
