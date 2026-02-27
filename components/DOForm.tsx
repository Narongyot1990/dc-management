'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import type { ScanResult } from '@/types';

interface DOFormProps {
  scanResult: ScanResult | null;
  scanImage: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onReset: () => void;
}

export default function DOForm({ scanResult, scanImage, onSave, onReset }: DOFormProps) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    dc_number: scanResult?.dc_number || '',
    document_date: scanResult?.document_date || '',
    document_time: scanResult?.document_time || '',
    delivery_date: scanResult?.delivery_date || '',
    delivery_time: scanResult?.delivery_time || '',
    return_date: scanResult?.return_date || '',
    return_time: scanResult?.return_time || '',
    driver_name: scanResult?.driver_name || '',
    driver_name_2: scanResult?.driver_name_2 || '',
    driver_phone: scanResult?.driver_phone || '',
    truck_plate_head: scanResult?.truck_plate_head || '',
    truck_plate_tail: scanResult?.truck_plate_tail || '',
    vehicle_type: scanResult?.vehicle_type || '',
    destination_branch: scanResult?.destination_branch || '',
    destination_address: scanResult?.destination_address || '',
    trip_no: '',
    notes: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...formData, scan_image: scanImage });
    } finally {
      setSaving(false);
    }
  };

  const isMissing = (field: string) => scanResult?.missing_fields?.includes(field) || false;

  const confidenceColor =
    scanResult?.confidence === 'high'
      ? 'bg-green-100 text-green-700 border-green-200'
      : scanResult?.confidence === 'medium'
        ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
        : 'bg-red-100 text-red-700 border-red-200';

  const confidenceLabel =
    scanResult?.confidence === 'high' ? t('confidence_high')
      : scanResult?.confidence === 'medium' ? t('confidence_medium')
        : t('confidence_low');

  const F = ({ label, field, placeholder, missing }: { label: string; field: string; placeholder?: string; missing?: boolean }) => (
    <Input
      label={label}
      value={formData[field as keyof typeof formData] ?? ''}
      onChange={(v) => handleChange(field, v)}
      placeholder={placeholder}
      highlight={missing}
      hint={missing ? '(AI ไม่พบ)' : undefined}
    />
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{t('scan_result')}</h2>
        {scanResult && (
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${confidenceColor}`}>
            {t('confidence')}: {confidenceLabel}
          </span>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Document */}
        <Section title={t('document_section')}>
          <div className="grid grid-cols-2 gap-3">
            <F label={t('dc_number')} field="dc_number" missing={isMissing('dc_number')} />
            <F label={t('document_date')} field="document_date" placeholder="DD/MM/YYYY" missing={isMissing('document_date')} />
            <F label={t('document_time')} field="document_time" placeholder="HH:MM" missing={isMissing('document_time')} />
          </div>
        </Section>

        {/* Schedule */}
        <Section title={t('schedule_section')}>
          <div className="grid grid-cols-2 gap-3">
            <F label={t('delivery_date')} field="delivery_date" placeholder="DD/MM/YYYY" missing={isMissing('delivery_date')} />
            <F label={t('delivery_time')} field="delivery_time" placeholder="HH:MM" missing={isMissing('delivery_time')} />
            <F label={t('return_date')} field="return_date" placeholder="DD/MM/YYYY" missing={isMissing('return_date')} />
            <F label={t('return_time')} field="return_time" placeholder="HH:MM" missing={isMissing('return_time')} />
          </div>
        </Section>

        {/* Driver */}
        <Section title={t('driver_section')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F label={t('driver_name')} field="driver_name" missing={isMissing('driver_name')} />
            <F label={t('driver_name_2')} field="driver_name_2" placeholder={t('driver_name_2_hint')} />
            <F label={t('driver_phone')} field="driver_phone" missing={isMissing('driver_phone')} />
          </div>
        </Section>

        {/* Vehicle */}
        <Section title={t('vehicle_section')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <F label={t('truck_plate_head')} field="truck_plate_head" placeholder="XXX-XXXX" missing={isMissing('truck_plate_head')} />
            <F label={t('truck_plate_tail')} field="truck_plate_tail" placeholder="XXX-XXXX" />
            <F label={t('vehicle_type')} field="vehicle_type" placeholder="6W / รถพ่วง / 10W" missing={isMissing('vehicle_type')} />
          </div>
        </Section>

        {/* Destination */}
        <Section title={t('destination_section')}>
          <div className="grid grid-cols-1 gap-3">
            <F label={t('destination_branch')} field="destination_branch" missing={isMissing('destination_branch')} />
            <F label={t('destination_address')} field="destination_address" missing={isMissing('destination_address')} />
          </div>
        </Section>

        {/* Additional */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <F label={t('trip_no')} field="trip_no" />
          <F label={t('notes')} field="notes" />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" type="button" onClick={onReset} className="flex-1">
            {t('cancel')}
          </Button>
          <Button variant="success" type="submit" disabled={saving} className="flex-1">
            {saving ? <><Spinner /> {t('saving')}</> : t('save')}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}
