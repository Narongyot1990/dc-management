"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ImagePlus, X, ScanLine, Loader2, Check, AlertCircle, RefreshCw, Link2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ContainerScanResult } from '@/types';

// LINE's in-app WebView on Android doesn't grant getUserMedia camera access at
// all (it never prompts), so there's no retry that can fix it from here - the
// only way out is opening the page in a real browser.
const isLineInAppBrowser = () => typeof navigator !== 'undefined' && /\bLine\//i.test(navigator.userAgent);

interface ContainerScannerProps {
  /** Yard mode also reads size and chassis plate from the same image. */
  mode?: 'container' | 'yard';
  onScan: (result: ContainerScanResult) => void;
  onClose: () => void;
}

export function ContainerScanner({ mode = 'container', onScan, onClose }: ContainerScannerProps) {
  const { t } = useLanguage();
  const [cameraState, setCameraState] = useState<'starting' | 'ready' | 'error' | 'unsupported_webview'>('starting');
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [videoRect, setVideoRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const processingRef = useRef(false);
  const activeRef = useRef(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // `object-contain` letterboxes the video inside its element whenever the
  // stream's aspect ratio doesn't match the container's - the guide frame
  // has to track that actual displayed image rect, not the element's full
  // box, or it ends up drawn partly over the black bars.
  const updateVideoRect = useCallback(() => {
    const video = videoRef.current;
    const container = previewRef.current;
    if (!video || !container || !video.videoWidth || !video.videoHeight) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;
    const scale = Math.min(cw / video.videoWidth, ch / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    setVideoRect({ left: (cw - width) / 2, top: (ch - height) / 2, width, height });
  }, []);

  useEffect(() => {
    if (cameraState !== 'ready') { setVideoRect(null); return; }
    const video = videoRef.current;
    const container = previewRef.current;
    if (!video || !container) return;

    updateVideoRect();

    const resizeObserver = new ResizeObserver(updateVideoRect);
    resizeObserver.observe(container);
    video.addEventListener('loadedmetadata', updateVideoRect);
    video.addEventListener('resize', updateVideoRect);
    window.addEventListener('orientationchange', updateVideoRect);

    return () => {
      resizeObserver.disconnect();
      video.removeEventListener('loadedmetadata', updateVideoRect);
      video.removeEventListener('resize', updateVideoRect);
      window.removeEventListener('orientationchange', updateVideoRect);
    };
  }, [cameraState, updateVideoRect]);

  const handleClose = useCallback(() => {
    activeRef.current = false;
    requestRef.current?.abort();
    stopCamera();
    onClose();
  }, [onClose, stopCamera]);

  // Opening Scan immediately requests the rear camera. A late permission result
  // is disposed if the dialog has closed (also safe under React Strict Mode).
  useEffect(() => {
    let cancelled = false;
    let localStream: MediaStream | null = null;
    activeRef.current = true;
    const openCamera = async () => {
      if (isLineInAppBrowser()) {
        if (!cancelled && activeRef.current) setCameraState('unsupported_webview');
        return;
      }
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled || !activeRef.current) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = localStream;
        const video = videoRef.current;
        if (!video) throw new Error('Preview unavailable');
        video.srcObject = localStream;
        await video.play();
        if (!cancelled && activeRef.current) setCameraState('ready');
      } catch {
        localStream?.getTracks().forEach((track) => track.stop());
        if (!cancelled && activeRef.current) setCameraState('error');
      }
    };
    void openCamera();
    return () => {
      cancelled = true;
      activeRef.current = false;
      localStream?.getTracks().forEach((track) => track.stop());
      requestRef.current?.abort();
    };
  }, [cameraAttempt]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); handleClose(); }
      if (event.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [handleClose]);

  const scanCanvas = async (canvas: HTMLCanvasElement) => {
    if (!activeRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    try {
      const image = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(image);
      const response = await fetch('/api/ocr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mode }), signal: controller.signal,
      });
      if (!response.ok) throw new Error('OCR request failed');
      const data = await response.json();
      if (!activeRef.current) return;
      if (!data.containerNumber) {
        setError(tRef.current('scanner_error_not_found'));
        return;
      }
      stopCamera();
      onScan({ containerNumber: data.containerNumber, size: data.size ?? null, chassisPlate: data.chassisPlate ?? null });
    } catch {
      if (activeRef.current) setError(tRef.current('scanner_error_processing'));
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  // Keep the whole preview frame: what the user sees is what OCR receives.
  const makeCanvas = (source: CanvasImageSource, width: number, height: number) => {
    if (!width || !height) throw new Error('Image not ready');
    const scale = Math.min(1, 1920 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const runScan = async (getCanvas: () => Promise<HTMLCanvasElement> | HTMLCanvasElement) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setError(null);
    try {
      const canvas = await getCanvas();
      if (activeRef.current) await scanCanvas(canvas);
    } catch {
      if (activeRef.current) setError(tRef.current('scanner_error_image'));
    } finally {
      processingRef.current = false;
      if (activeRef.current) { setIsProcessing(false); setCapturedImage(null); }
    }
  };

  const handleCapture = () => void runScan(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) throw new Error('Camera not ready');
    return makeCanvas(video, video.videoWidth, video.videoHeight);
  });

  const handleFile = (file: File) => void runScan(async () => {
    if (!file.type.startsWith('image/')) throw new Error('Invalid image');
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      return makeCanvas(image, image.naturalWidth, image.naturalHeight);
    } finally { URL.revokeObjectURL(url); }
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1500);
    } catch { /* clipboard unavailable, nothing more we can do */ }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center sm:p-6" onClick={(event) => event.stopPropagation()}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="scanner-title" className="flex flex-col w-full h-[100dvh] sm:h-[min(90dvh,850px)] sm:max-w-2xl bg-slate-950 sm:rounded-3xl overflow-hidden text-white">
        <header className="flex items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] shrink-0 [@media(max-height:500px)]:py-1.5">
          <div className="flex gap-3 items-center"><ScanLine className="w-6 h-6 text-amber-400" /><h2 id="scanner-title" className="text-base font-semibold">{t('scanner_title')}</h2></div>
          <button type="button" onClick={handleClose} aria-label={t('yc_close')} className="min-w-11 min-h-11 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"><X className="w-5 h-5" /></button>
        </header>
        <div ref={previewRef} className="relative flex-1 min-h-0 bg-black overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-contain ${capturedImage ? 'invisible' : ''}`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {capturedImage && <img src={capturedImage} alt={t('scanner_captured')} className="absolute inset-0 w-full h-full object-contain" />}
          {/* Guide frame tracks the video's actual displayed (object-contain)
              bounds via videoRect, inset by a small margin - not the whole
              element box, which can include letterboxed black bars the
              camera isn't actually showing. The capture already uses the
              full video frame regardless (see makeCanvas below), so this is
              purely about not misleading the user about the real image area. */}
          {cameraState === 'ready' && !isProcessing && <div className="absolute inset-0 pointer-events-none">
            <span className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 text-xs"><span className="w-2 h-2 rounded-full bg-emerald-400" />{t('scanner_ready')}</span>
            {videoRect && (
              <div
                className="absolute border-2 border-white/70 rounded-2xl shadow-[0_0_0_999px_rgba(0,0,0,0.12)]"
                style={{
                  left: videoRect.left + Math.min(10, videoRect.width * 0.03),
                  top: videoRect.top + Math.min(10, videoRect.height * 0.08),
                  width: Math.max(0, videoRect.width - Math.min(10, videoRect.width * 0.03) * 2),
                  height: Math.max(0, videoRect.height - Math.min(10, videoRect.height * 0.08) * 2),
                }}
              />
            )}
            <p className="absolute bottom-3 left-3 right-3 text-center text-sm rounded-xl bg-black/65 p-3">{t(mode === 'yard' ? 'scanner_aim_yard' : 'scanner_aim')}</p>
          </div>}
          {cameraState === 'starting' && !isProcessing && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"><Loader2 className="h-9 w-9 animate-spin text-amber-400" /><p>{t('scanner_starting')}</p><p className="text-xs text-slate-400">{t('scanner_permission_hint')}</p></div>}
          {cameraState === 'error' && !isProcessing && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"><Camera className="h-12 w-12 text-slate-500" /><p className="text-sm max-w-xs text-slate-200">{t('scanner_error_camera')}</p><button type="button" onClick={() => { setCameraState('starting'); setError(null); setCameraAttempt((v) => v + 1); }} className="flex items-center gap-2 min-h-11 px-5 rounded-xl bg-white/10 hover:bg-white/20"><RefreshCw className="h-4 w-4" />{t('scanner_retry')}</button></div>}
          {cameraState === 'unsupported_webview' && !isProcessing && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Camera className="h-12 w-12 text-slate-500" />
            <p className="text-sm font-semibold max-w-xs text-slate-100">{t('scanner_line_unsupported_title')}</p>
            <p className="text-sm max-w-xs text-slate-300">{t('scanner_line_unsupported_body')}</p>
            <button type="button" onClick={handleCopyLink} className="flex items-center gap-2 min-h-11 px-5 rounded-xl bg-white/10 hover:bg-white/20">
              {linkCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4" />}
              {linkCopied ? t('scanner_link_copied') : t('scanner_copy_link')}
            </button>
            <p className="text-xs max-w-xs text-slate-400 mt-1">{t('scanner_line_gallery_hint')}</p>
          </div>}
          {isProcessing && <div role="status" aria-live="polite" className="absolute inset-0 bg-black/75 flex flex-col gap-4 items-center justify-center p-6 text-center"><span className="inline-flex gap-2 items-center text-emerald-300 text-sm"><Check className="h-4 w-4" />{t('scanner_captured')}</span><Loader2 className="h-10 w-10 animate-spin text-amber-400" /><p className="font-semibold">{t('scanner_processing')}</p><p className="text-sm text-slate-300">{t('scanner_captured_hint')}</p></div>}
        </div>
        <footer className="shrink-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-slate-950 space-y-3 [@media(max-height:500px)]:pt-1.5 [@media(max-height:500px)]:space-y-1.5">
          {error && <div role="alert" className="flex gap-2 rounded-xl bg-red-950 p-3 text-red-100 text-sm"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
          <div className="flex items-center gap-3">
            <button type="button" disabled={isProcessing} onClick={() => fileRef.current?.click()} className="flex min-h-14 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-40 [@media(max-height:500px)]:min-h-10"><ImagePlus className="h-5 w-5" /><span className="text-[11px]">{t('scanner_gallery')}</span></button>
            <button type="button" onClick={handleCapture} disabled={cameraState !== 'ready' || isProcessing} className="flex-1 min-h-14 rounded-2xl bg-amber-400 text-slate-950 font-semibold flex gap-2 items-center justify-center hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 [@media(max-height:500px)]:min-h-10">{isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}{t('scanner_capture_scan')}</button>
          </div>
          <p className="text-[11px] text-slate-400 text-center [@media(max-height:500px)]:hidden">{t('scanner_manual_hint')}</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) handleFile(file); }} />
        </footer>
      </div>
    </div>, document.body
  );
}
