'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import CameraCapture from '@/components/CameraCapture';
import DOForm from '@/components/DOForm';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import type { ScanResult } from '@/types';

interface DuplicateInfo {
  id: string;
  dc_number: string;
}

export default function ScanPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [image, setImage] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);

  const handleImageCapture = (base64: string) => {
    setImage(base64);
    setScanResult(null);
    setError(null);
    setSuccessMsg(null);
    setDuplicate(null);
  };

  const handleScan = async () => {
    if (!image) return;
    setIsScanning(true);
    setError(null);
    setDuplicate(null);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (data.error && !data.dc_number) { setError(data.error); return; }

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
    } catch {
      setError('Failed to scan document');
    } finally {
      setIsScanning(false);
    }
  };

  const handleGoToEdit = () => {
    if (!duplicate || !scanResult) return;
    const applyData = encodeURIComponent(JSON.stringify(scanResult));
    router.push(`/monitor?edit=${duplicate.id}&apply=${applyData}`);
  };

  const handleCancelDuplicate = () => {
    setDuplicate(null);
    setScanResult(null);
    setImage('');
  };

  const handleSave = async (formData: Record<string, unknown>) => {
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
      setTimeout(() => router.push('/monitor'), 1500);
    } catch {
      setError('Failed to save record');
    }
  };

  const handleReset = () => {
    setImage('');
    setScanResult(null);
    setError(null);
    setSuccessMsg(null);
    setDuplicate(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-800">{t('scan_title')}</h1>
        <p className="text-xs text-gray-500">{t('scan_subtitle')}</p>
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
          <div className="flex gap-2">
            <Button onClick={handleGoToEdit} className="flex-1">
              {t('go_to_edit')}
            </Button>
            <Button variant="outline" onClick={handleCancelDuplicate} className="flex-1">
              {t('cancel_scan')}
            </Button>
          </div>
        </div>
      )}

      {/* Camera Capture */}
      {!scanResult && !duplicate && (
        <CameraCapture onImageCapture={handleImageCapture} isScanning={isScanning} onScan={handleScan} />
      )}

      {/* Scan Result Form */}
      {scanResult && !duplicate && (
        <DOForm scanResult={scanResult} scanImage={image} onSave={handleSave} onReset={handleReset} />
      )}
    </div>
  );
}
