'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import type { IDeliveryOrder } from '@/types';

interface DOTableProps {
  records: IDeliveryOrder[];
  loading: boolean;
  onUpdate: (id: string, data: Record<string, string>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  autoEditId?: string | null;
  applyData?: Record<string, string> | null;
}

const EDITABLE_FIELDS = [
  'dc_number', 'document_date', 'document_time', 'delivery_date', 'delivery_time',
  'return_date', 'return_time', 'driver_name', 'driver_name_2',
  'driver_phone', 'truck_plate_head', 'truck_plate_tail', 'vehicle_type',
  'destination_branch', 'destination_address', 'trip_no', 'notes',
] as const;

function parseDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const [d, m, y] = date.split('/').map(Number);
  const [h, min] = time.split(':').map(Number);
  if (!d || !m || !y || isNaN(h) || isNaN(min)) return null;
  return new Date(y > 100 ? y : y + 2000, m - 1, d, h, min);
}

function calcLeadTime(doc: IDeliveryOrder): string | null {
  const start = parseDateTime(doc.document_date, doc.document_time);
  const end = parseDateTime(doc.return_date, doc.return_time);
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return null;
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
}

function formatPlanTime(doc: IDeliveryOrder): string {
  if (!doc.delivery_date) return '-';
  const parts = doc.delivery_date.split('/');
  const short = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : doc.delivery_date;
  return doc.delivery_time ? `${short} ${doc.delivery_time}` : short;
}

export default function DOTable({ records, loading, onUpdate, onDelete, autoEditId, applyData }: DOTableProps) {
  const { t } = useLanguage();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const appliedRef = useRef(false);

  // Auto-open edit mode when navigated from duplicate DC flow
  useEffect(() => {
    if (!autoEditId || !records.length || appliedRef.current) return;
    const record = records.find((r) => r._id === autoEditId);
    if (!record) return;
    appliedRef.current = true;
    setExpandedId(autoEditId);
    setEditingId(autoEditId);
    const form: Record<string, string> = {};
    for (const f of EDITABLE_FIELDS) form[f] = (record[f] as string) || '';
    // Apply new scan data over existing values
    if (applyData) {
      for (const [key, val] of Object.entries(applyData)) {
        if (val && key in form) form[key] = val;
      }
    }
    setEditForm(form);
  }, [autoEditId, applyData, records]);

  const startEdit = (record: IDeliveryOrder) => {
    setEditingId(record._id);
    const form: Record<string, string> = {};
    for (const f of EDITABLE_FIELDS) form[f] = (record[f] as string) || '';
    setEditForm(form);
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await onUpdate(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    } finally {
      setSaving(false);
    }
  };

  const ch = (field: string, value: string) => setEditForm((p) => ({ ...p, [field]: value }));

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Spinner className="h-8 w-8" />
          <span className="text-sm">{t('loading')}</span>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm">{t('no_data')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {records.map((record) => {
        const isExpanded = expandedId === record._id;
        const isEditing = editingId === record._id;
        const noTripNo = !record.trip_no;
        const leadTime = calcLeadTime(record);
        const planTime = formatPlanTime(record);
        const is6WPlus = record.vehicle_type === '6W+';

        return (
          <div
            key={record._id}
            className={`bg-white rounded-xl shadow-sm border overflow-hidden ${noTripNo ? 'border-orange-200' : 'border-gray-100'}`}
          >
            {/* Card Header - 3 rows */}
            <button
              onClick={() => { if (!isEditing) setExpandedId(isExpanded ? null : record._id); }}
              className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
            >
              {/* Row 1: destination_branch + trip badge */}
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-800 text-sm truncate">{record.destination_branch || '-'}</span>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {noTripNo && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200">
                      {t('no_trip_no')}
                    </span>
                  )}
                  <svg className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Row 2: plan_time (lead_time) + dc_number */}
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500">
                  {planTime}
                  {leadTime && <span className="text-blue-500 ml-1">({leadTime})</span>}
                </span>
                <span className="text-gray-500 font-mono">{record.dc_number || '-'}</span>
              </div>

              {/* Row 3: vehicle_type badge + plates */}
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${is6WPlus ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {record.vehicle_type || '6W'}
                </span>
                <span className="text-gray-600">{record.truck_plate_head || '-'}</span>
                {record.truck_plate_tail && (
                  <span className="text-gray-400">{record.truck_plate_tail}</span>
                )}
              </div>
            </button>

            {/* Expanded */}
            {isExpanded && (
              <div className="px-3 pb-3 border-t border-gray-50">
                {isEditing ? (
                  <div className="py-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Input compact label={t('dc_number')} value={editForm.dc_number || ''} onChange={(v) => ch('dc_number', v)} />
                      <Input compact label={t('document_date')} value={editForm.document_date || ''} onChange={(v) => ch('document_date', v)} placeholder="DD/MM/YYYY" />
                      <Input compact label={t('document_time')} value={editForm.document_time || ''} onChange={(v) => ch('document_time', v)} placeholder="HH:MM" />
                      <Input compact label={t('delivery_date')} value={editForm.delivery_date || ''} onChange={(v) => ch('delivery_date', v)} placeholder="DD/MM/YYYY" />
                      <Input compact label={t('delivery_time')} value={editForm.delivery_time || ''} onChange={(v) => ch('delivery_time', v)} placeholder="HH:MM" />
                      <Input compact label={t('return_date')} value={editForm.return_date || ''} onChange={(v) => ch('return_date', v)} placeholder="DD/MM/YYYY" />
                      <Input compact label={t('return_time')} value={editForm.return_time || ''} onChange={(v) => ch('return_time', v)} placeholder="HH:MM" />
                      <Input compact label={t('driver_name')} value={editForm.driver_name || ''} onChange={(v) => ch('driver_name', v)} />
                      <Input compact label={t('driver_name_2')} value={editForm.driver_name_2 || ''} onChange={(v) => ch('driver_name_2', v)} />
                      <Input compact label={t('driver_phone')} value={editForm.driver_phone || ''} onChange={(v) => ch('driver_phone', v)} />
                      <Input compact label={t('truck_plate_head')} value={editForm.truck_plate_head || ''} onChange={(v) => ch('truck_plate_head', v)} />
                      <Input compact label={t('truck_plate_tail')} value={editForm.truck_plate_tail || ''} onChange={(v) => ch('truck_plate_tail', v)} />
                      <Input compact label={t('vehicle_type')} value={editForm.vehicle_type || ''} onChange={(v) => ch('vehicle_type', v)} placeholder="6W / 6W+" />
                      <div className="col-span-2">
                        <Input compact label={t('destination_branch')} value={editForm.destination_branch || ''} onChange={(v) => ch('destination_branch', v)} />
                      </div>
                      <div className="col-span-2">
                        <Input compact label={t('destination_address')} value={editForm.destination_address || ''} onChange={(v) => ch('destination_address', v)} />
                      </div>
                      <Input compact label={t('trip_no')} value={editForm.trip_no || ''} onChange={(v) => ch('trip_no', v)} highlight={!editForm.trip_no} />
                      <Input compact label={t('notes')} value={editForm.notes || ''} onChange={(v) => ch('notes', v)} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button compact variant="outline" onClick={cancelEdit} className="flex-1">{t('cancel')}</Button>
                      <Button compact variant="success" onClick={saveEdit} disabled={saving} className="flex-1">
                        {saving ? t('saving') : t('save')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 text-sm">
                      <D label={t('dc_number')} value={record.dc_number} />
                      <D label={t('document_date')} value={record.document_date} />
                      <D label={t('document_time')} value={record.document_time} />
                      <D label={t('delivery_date')} value={record.delivery_date} />
                      <D label={t('delivery_time')} value={record.delivery_time} />
                      <D label={t('return_date')} value={record.return_date} />
                      <D label={t('return_time')} value={record.return_time} />
                      <D label={t('lead_time')} value={leadTime} />
                      <D label={t('driver_name')} value={record.driver_name} />
                      <D label={t('driver_name_2')} value={record.driver_name_2} />
                      <D label={t('driver_phone')} value={record.driver_phone} />
                      <D label={t('truck_plate_head')} value={record.truck_plate_head} />
                      <D label={t('truck_plate_tail')} value={record.truck_plate_tail} />
                      <D label={t('vehicle_type')} value={record.vehicle_type} />
                      <D label={t('destination_branch')} value={record.destination_branch} />
                      <div className="col-span-2">
                        <D label={t('destination_address')} value={record.destination_address} />
                      </div>
                      <D label={t('trip_no')} value={record.trip_no} highlight={!record.trip_no} />
                      {record.notes && <D label={t('notes')} value={record.notes} />}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <Button compact onClick={() => startEdit(record)} className="flex-1">{t('edit')}</Button>
                      <Button compact variant="danger" onClick={() => { if (confirm(t('confirm_delete'))) onDelete(record._id); }}>
                        {t('delete')}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function D({ label, value, highlight }: { label: string; value?: string | number | null; highlight?: boolean }) {
  return (
    <div>
      <span className="text-xs text-gray-400">{label}</span>
      <p className={`font-medium text-sm truncate ${highlight ? 'text-orange-500' : 'text-gray-700'}`}>{value || '-'}</p>
    </div>
  );
}
