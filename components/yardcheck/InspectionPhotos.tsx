"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Pencil, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface InspectionPhotosProps {
  photos: string[];
  readOnly: boolean;
  busy: boolean;
  uploading: boolean;
  onSelect: (file: File, replaceIndex?: number) => Promise<void>;
  onRemove: (index: number) => void;
}

// All photo actions stay in the draft checklist until Submit Inspection is pressed.
export function InspectionPhotos({ photos, readOnly, busy, uploading, onSelect, onRemove }: InspectionPhotosProps) {
  const { t } = useLanguage();
  const [viewer, setViewer] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<number | undefined>(undefined);
  const overlayRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const dialogOpen = viewer !== null || deleting !== null;

  const navigate = (delta: number) => {
    setViewer((index) => index === null ? null : (index + delta + photos.length) % photos.length);
    setZoomed(false);
    viewportRef.current?.scrollTo(0, 0);
  };

  useEffect(() => {
    if (menu === null) return;
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setMenu(null); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [menu]);

  useEffect(() => {
    if (!dialogOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    overlayRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (deleting !== null) setDeleting(null);
        else { setViewer(null); setZoomed(false); }
      }
      if (deleting === null && photos.length > 1 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        setViewer((index) => index === null ? null : (index + (event.key === 'ArrowRight' ? 1 : -1) + photos.length) % photos.length);
        setZoomed(false);
        viewportRef.current?.scrollTo(0, 0);
      }
      if (event.key === 'Tab') {
        const buttons = overlayRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
        if (!buttons?.length) { event.preventDefault(); return; }
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === overlayRef.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === overlayRef.current)) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown, true);
      previousFocus?.focus();
    };
  }, [dialogOpen, deleting, photos.length]);

  const chooseFile = (index?: number) => {
    replaceRef.current = index;
    setMenu(null);
    fileRef.current?.click();
  };
  const closeViewer = () => { setViewer(null); setZoomed(false); };
  const photoLabel = (index: number) => `${t('yc_photo')} ${index + 1}`;
  const iconButton = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white';

  return (
    <div className="px-3 pb-3">
      <div className="flex flex-wrap gap-3 items-start">
        {photos.map((photo, index) => (
          <div key={`${index}-${photo}`} className="relative w-24">
            <button type="button" onClick={() => { setViewer(index); setZoomed(false); }} aria-label={`${t('yc_view_photo')} ${index + 1}`} className="block w-24 h-24 overflow-hidden rounded-xl border border-gray-200 bg-white focus-visible:outline-2 focus-visible:outline-blue-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={photoLabel(index)} className="h-full w-full object-cover" />
            </button>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">{photoLabel(index)}</span>
              {!readOnly && <button type="button" disabled={busy} aria-label={`${t('yc_photo_actions')} ${index + 1}`} aria-expanded={menu === index} aria-haspopup="true" onClick={() => setMenu(menu === index ? null : index)} className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40"><MoreHorizontal className="w-5 h-5" /></button>}
            </div>
            {menu === index && !readOnly && (
              <div ref={menuRef} className="absolute top-12 left-0 z-20 w-44 rounded-xl bg-white border border-gray-200 shadow-xl p-1" aria-label={t('yc_photo_actions')}>
                <button type="button" onClick={() => chooseFile(index)} className="w-full flex items-center gap-2 p-3 text-sm text-gray-700 rounded-lg hover:bg-gray-50"><Pencil className="h-4 w-4" />{t('yc_replace_photo')}</button>
                <button type="button" onClick={() => { setMenu(null); setDeleting(index); }} className="w-full flex items-center gap-2 p-3 text-sm text-red-600 rounded-lg hover:bg-red-50"><Trash2 className="h-4 w-4" />{t('yc_delete_photo')}</button>
              </div>
            )}
          </div>
        ))}
        {!readOnly && photos.length < 3 && !uploading && <button type="button" disabled={busy} onClick={() => chooseFile()} className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-40"><Camera className="h-6 w-6" /><span className="text-[11px]">{t('yc_add_photo')}</span></button>}
        {uploading && <div role="status" className="w-24 h-24 flex flex-col items-center justify-center gap-2 text-amber-600 border-2 border-dashed border-amber-300 rounded-xl"><Loader2 className="h-6 w-6 animate-spin" /><span className="text-[11px]">{t('yc_uploading_photo')}</span></div>}
      </div>
      {!readOnly && <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void onSelect(file, replaceRef.current);
      }} />}
      {viewer !== null && photos[viewer] && createPortal(
        <div ref={overlayRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('yc_view_photo')} className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col" onClick={(event) => event.stopPropagation()}>
          <div className="shrink-0 flex items-center justify-between px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] bg-slate-900">
            <span className="text-sm font-medium" aria-live="polite">{t('yc_photo')} {viewer + 1} / {photos.length}</span>
            <div className="flex gap-2">
              <button type="button" className={iconButton} aria-label={zoomed ? t('yc_zoom_out') : t('yc_zoom_in')} onClick={() => { setZoomed(!zoomed); viewportRef.current?.scrollTo(0, 0); }}>{zoomed ? <ZoomOut /> : <ZoomIn />}</button>
              <button type="button" className={iconButton} aria-label={t('yc_close')} onClick={closeViewer}><X /></button>
            </div>
          </div>
          <div ref={viewportRef} className="flex-1 min-h-0 overflow-auto" onTouchStart={(event) => { const p = event.touches[0]; touchRef.current = { x: p.clientX, y: p.clientY }; }} onTouchEnd={(event) => {
            const start = touchRef.current; touchRef.current = null;
            if (!start || zoomed || photos.length < 2) return;
            const end = event.changedTouches[0], dx = end.clientX - start.x, dy = end.clientY - start.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { event.preventDefault(); navigate(dx < 0 ? 1 : -1); }
          }}>
            <button type="button" aria-label={zoomed ? t('yc_zoom_out') : t('yc_zoom_in')} onClick={() => setZoomed(!zoomed)} className={zoomed ? 'block w-[200%] h-[200%] cursor-zoom-out' : 'flex h-full w-full items-center justify-center p-2 cursor-zoom-in'}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[viewer]} alt={photoLabel(viewer)} draggable={false} className="w-full h-full object-contain" />
            </button>
          </div>
          <div className="shrink-0 bg-slate-900 flex items-center justify-between px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {photos.length > 1 ? <button type="button" className={iconButton} aria-label={t('yc_previous_photo')} onClick={() => navigate(-1)}><ChevronLeft /></button> : <span />}
            <span className="text-xs text-slate-300">{zoomed ? t('yc_photo_zoom_hint') : t('yc_photo_view_hint')}</span>
            {photos.length > 1 ? <button type="button" className={iconButton} aria-label={t('yc_next_photo')} onClick={() => navigate(1)}><ChevronRight /></button> : <span />}
          </div>
        </div>, document.body
      )}
      {deleting !== null && createPortal(
        <div className="fixed inset-0 z-[110] bg-black/65 flex items-center justify-center p-4" onClick={(event) => event.stopPropagation()}>
          <div ref={overlayRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="photo-delete-title" aria-describedby="photo-delete-description" className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl">
            <div className="flex gap-3 items-center mb-3 text-red-600"><Trash2 className="h-6 w-6" /><h2 id="photo-delete-title" className="font-semibold">{t('yc_delete_photo')}</h2></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[deleting]} alt={photoLabel(deleting)} className="w-full h-40 object-contain bg-gray-50 rounded-xl mb-3" />
            <p id="photo-delete-description" className="text-sm text-gray-600">{t('yc_delete_photo_confirm')}</p>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setDeleting(null)} className="flex-1 min-h-11 rounded-xl bg-gray-100 text-gray-700 font-medium">{t('cancel')}</button>
              <button type="button" disabled={busy} onClick={() => { onRemove(deleting); setDeleting(null); }} className="flex-1 min-h-11 rounded-xl bg-red-600 text-white font-medium disabled:opacity-40">{t('yc_delete_photo')}</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
