'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { IShipmentBooking } from '@/types';
import type { BranchData } from '@/components/MapView';
import branchesRaw from '@/data/branches.json';

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

interface PlanRow {
  id: string;
  destination_branch: string;
  pickup_time: string;
  truck_plate_head: string;
  dock_number: string;
}

function newRow(): PlanRow {
  return { id: crypto.randomUUID(), destination_branch: '', pickup_time: '', truck_plate_head: '', dock_number: '' };
}

function resolveBranch(input: string): { name: string; matched: BranchData | undefined } {
  const q = input.trim();
  const byCode = branches.find((b) => b.code.toLowerCase() === q.toLowerCase());
  if (byCode) return { name: byCode.name || byCode.code, matched: byCode };
  const byName = branches.find(
    (b) => b.name && (b.name === q || q.includes(b.name) || b.name.includes(q))
  );
  if (byName) return { name: byName.name || byName.code, matched: byName };
  return { name: q, matched: undefined };
}

function parsePastedText(text: string): PlanRow[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows: PlanRow[] = [];
  for (const line of lines) {
    const parts = line.split(/\t|  +/);
    const col0 = parts[0]?.trim() || '';
    const col1 = parts[1]?.trim() || '';
    const col2 = parts[2]?.trim() || '';
    if (!col0) continue;
    const isTime = /^\d{1,2}:\d{2}$/.test(col1);
    const col3 = parts[3]?.trim() || '';
    if (col2) {
      rows.push({ id: crypto.randomUUID(), destination_branch: col0, pickup_time: col1, truck_plate_head: col2, dock_number: col3 });
    } else if (isTime) {
      rows.push({ id: crypto.randomUUID(), destination_branch: col0, pickup_time: col1, truck_plate_head: '', dock_number: '' });
    } else {
      rows.push({ id: crypto.randomUUID(), destination_branch: col0, pickup_time: '', truck_plate_head: col1, dock_number: '' });
    }
  }
  return rows;
}

function getProgressInfo(b: IShipmentBooking) {
  const fields = ['loading_start', 'loading_end', 'arrival_branch', 'departure_branch', 'return_dc'] as const;
  const filled = fields.filter((f) => !!b[f]).length;
  return { filled, total: fields.length };
}

export default function PlanPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'form' | 'paste'>('form');
  const [pickupDate, setPickupDate] = useState(getTodayStr());
  const [rows, setRows] = useState<PlanRow[]>([newRow()]);
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<PlanRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [bookings, setBookings] = useState<IShipmentBooking[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!pickupDate) return;
    setLoadingList(true);
    try {
      const res = await fetch(`/api/shipment-bookings?pickup_date=${encodeURIComponent(pickupDate)}`);
      const json = await res.json();
      if (json.success) setBookings(json.data || []);
    } catch { /* silent */ }
    finally { setLoadingList(false); }
  }, [pickupDate]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  useEffect(() => {
    if (pasteText.trim()) {
      setParsedRows(parsePastedText(pasteText));
    } else {
      setParsedRows([]);
    }
  }, [pasteText]);

  function addRow() { setRows((prev) => [...prev, newRow()]); }
  function removeRow(id: string) { setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id))); }
  function updateRow(id: string, field: keyof PlanRow, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleSave() {
    const dataRows = mode === 'paste' ? parsedRows : rows;
    const valid = dataRows.filter((r) => r.destination_branch);
    if (valid.length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/shipment-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookings: valid.map((r) => {
            const { name: resolvedName } = resolveBranch(r.destination_branch);
            return {
              pickup_date: pickupDate,
              destination_branch: resolvedName,
              pickup_time: r.pickup_time,
              truck_plate_head: r.truck_plate_head,
              dock_number: r.dock_number,
            };
          }),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: `${t('booking_saved')} (${valid.length} ${t('records')})` });
        if (mode === 'paste') { setPasteText(''); setParsedRows([]); }
        else { setRows([newRow()]); }
        fetchBookings();
      } else {
        setMessage({ type: 'error', text: json.error || 'Error' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Network error' });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('confirm_delete_booking'))) return;
    try {
      const res = await fetch(`/api/shipment-bookings/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: t('booking_deleted') });
        fetchBookings();
      }
    } catch { /* silent */ }
  }

  const selectableBranches = branches.filter((b) => b.name);
  const canSave = mode === 'paste' ? parsedRows.length > 0 : rows.some((r) => r.destination_branch);
  const draftCount = bookings.filter((b) => b.status === 'draft').length;
  const doneCount = bookings.filter((b) => b.status === 'fulfilled').length;

  return (
    <div className="max-w-2xl mx-auto p-4 pt-6">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-800">{t('plan_title')}</h1>
        <p className="text-xs text-gray-500">{t('plan_subtitle')}</p>
      </div>

      {/* Create Plan Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        {/* Date + Mode Toggle */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">{t('pickup_date')}</label>
          <input
            type="date"
            value={toInputDate(pickupDate)}
            onChange={(e) => setPickupDate(fromInputDate(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 flex-1 min-w-[140px]"
          />
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setMode('form')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'form' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('plan_mode_single')}
            </button>
            <button
              onClick={() => setMode('paste')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'paste' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('plan_mode_batch')}
            </button>
          </div>
        </div>

        {/* Form Mode */}
        {mode === 'form' && (
          <>
            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-5 text-right">{idx + 1}</span>
                  <select
                    value={row.destination_branch}
                    onChange={(e) => updateRow(row.id, 'destination_branch', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 flex-1 min-w-0"
                  >
                    <option value="">{t('destination_branch')}...</option>
                    {selectableBranches.map((b) => (
                      <option key={b.code} value={b.name}>[{b.code}] {b.name}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={row.pickup_time}
                    onChange={(e) => updateRow(row.id, 'pickup_time', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-24"
                  />
                  <input
                    type="text"
                    value={row.truck_plate_head}
                    onChange={(e) => updateRow(row.id, 'truck_plate_head', e.target.value)}
                    placeholder={t('truck_plate_head')}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-28"
                  />
                  <input
                    type="text"
                    value={row.dock_number}
                    onChange={(e) => updateRow(row.id, 'dock_number', e.target.value)}
                    placeholder={t('dock_placeholder')}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-20 text-center"
                  />
                  <button
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addRow}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('add_destination')}
            </button>
          </>
        )}

        {/* Paste Mode */}
        {mode === 'paste' && (
          <>
            <div className="mb-2">
              <div className="text-xs text-gray-500 mb-2 bg-gray-50 rounded-lg px-3 py-2">
                Copy จาก Excel แล้ว Paste ที่นี่ (คอลัมน์: <strong>รหัสสาขา</strong> [Tab] <strong>เวลาโหลด</strong> [Tab] <strong>ทะเบียนรถ</strong>)
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"NIN\t09:00\t700-2131\nSMP\t09:30\t700-3312\nUDN\t10:00\t700-5463"}
                rows={5}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono resize-y"
              />
            </div>
            {parsedRows.length > 0 && (
              <div className="border border-blue-100 rounded-lg overflow-hidden mb-2">
                <div className="bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 flex justify-between">
                  <span>Preview</span>
                  <span>{parsedRows.length} {t('records')}</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500">
                        <th className="px-3 py-1.5 text-left w-8">#</th>
                        <th className="px-3 py-1.5 text-left">{t('destination_branch')}</th>
                        <th className="px-3 py-1.5 text-left w-16">{t('pickup_time')}</th>
                        <th className="px-3 py-1.5 text-left w-24">{t('truck_plate_head')}</th>
                        <th className="px-3 py-1.5 text-center w-14">Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((r, i) => {
                        const { name: resolvedName, matched } = resolveBranch(r.destination_branch);
                        return (
                          <tr key={r.id} className="border-t border-gray-100">
                            <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                            <td className="px-3 py-1.5">
                              <span className="text-gray-800 font-medium">{r.destination_branch}</span>
                              {matched && resolvedName !== r.destination_branch && (
                                <span className="text-gray-400 ml-1 text-[10px]">→ {resolvedName}</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-gray-600">{r.pickup_time || '—'}</td>
                            <td className="px-3 py-1.5 text-gray-600 font-mono text-[10px]">{r.truck_plate_head || '—'}</td>
                            <td className="px-3 py-1.5 text-center">
                              {matched ? (
                                <span className="inline-flex items-center gap-0.5 text-green-600 font-medium">
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  {matched.code}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-red-500 font-medium">
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Message */}
        {message && (
          <div className={`mt-3 text-xs rounded-lg px-3 py-2 ${
            message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="mt-4 w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? t('saving') : t('save_booking')}
        </button>
      </div>

      {/* Existing Plans List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-800">
            {t('plan_title')} — {pickupDate}
          </h2>
          <div className="flex items-center gap-2">
            {draftCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {draftCount} {t('draft')}
              </span>
            )}
            {doneCount > 0 && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {doneCount} {t('fulfilled')}
              </span>
            )}
          </div>
        </div>

        {loadingList ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">{t('no_bookings')}</div>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => {
              const { filled, total } = getProgressInfo(b);
              const isDone = b.status === 'fulfilled';
              return (
                <div
                  key={b._id}
                  className={`flex items-center justify-between gap-3 border rounded-xl px-4 py-3 ${
                    isDone ? 'border-green-200 bg-green-50/50' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`font-mono font-bold text-sm px-2.5 py-1 rounded-lg ${
                      isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {b.truck_plate_head || '—'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{b.destination_branch}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {b.pickup_time && <span>{b.pickup_time}</span>}
                        {filled > 0 && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            filled === total ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {filled}/{total}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    isDone ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {t(b.status)}
                  </span>
                  {!isDone && (
                    <button
                      onClick={() => handleDelete(b._id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
