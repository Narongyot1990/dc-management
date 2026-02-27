'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

interface CameraCaptureProps {
  onImageCapture: (base64: string) => void;
  isScanning: boolean;
  onScan: () => void;
}

type Mode = 'idle' | 'camera' | 'preview';

export default function CameraCapture({ onImageCapture, isScanning, onScan }: CameraCaptureProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<Mode>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError(t('camera_error'));
      setMode('idle');
    }
  }, [t]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);

    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    stopStream();
    setPreview(base64);
    setMode('preview');
    onImageCapture(base64);
  };

  const resizeImage = (file: File, maxSize = 1600, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize; }
          else { width = Math.round((width * maxSize) / height); height = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopStream();
    const base64 = await resizeImage(file);
    setPreview(base64);
    setMode('preview');
    onImageCapture(base64);
  };

  const handleRetake = () => {
    setPreview(null);
    setCameraError(null);
    setMode('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-800">{t('scan_title')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('scan_subtitle')}</p>
      </div>

      <div className="p-4">
        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

        {cameraError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{cameraError}</div>
        )}

        {mode === 'idle' && (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50">
              <CameraIcon className="mx-auto h-16 w-16 text-gray-300" />
              <p className="mt-3 text-gray-400 text-sm">{t('no_image')}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={startCamera} className="flex-1">
                <CameraIcon className="h-5 w-5" /> {t('capture_photo')}
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1">
                <AttachIcon className="h-5 w-5" /> {t('attach_image')}
              </Button>
            </div>
          </div>
        )}

        {mode === 'camera' && (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-4/3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { stopStream(); setMode('idle'); }} className="flex-1">
                {t('cancel')}
              </Button>
              <Button onClick={captureFrame} className="flex-1">
                <CaptureIcon className="h-5 w-5" /> {t('capture_photo')}
              </Button>
            </div>
          </div>
        )}

        {mode === 'preview' && preview && (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border-2 border-blue-200 bg-gray-50">
              <img src={preview} alt="DO Document" className="w-full max-h-[60vh] object-contain" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRetake} className="flex-1">{t('retake')}</Button>
              <Button onClick={onScan} disabled={isScanning} className="flex-1">
                {isScanning ? <><Spinner /> {t('scanning')}</> : t('scan_document')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function AttachIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

function CaptureIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}
