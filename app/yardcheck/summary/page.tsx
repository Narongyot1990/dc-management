"use client";

import './fls-theme.css';

import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useRef, useMemo, useCallback, useEffect, Suspense, type PointerEvent as ReactPointerEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import type { YardCheck, YardCheckType } from '@/types';
import { formatDateTimeRelative, formatDate, formatTime, formatDateTime } from '@/utils/format';
import { getYardEmptyDisplayStatus, getYardCardTypeBadgeClass, getYardCardSizeBadgeClass, YARD_CARD_CONTAINER_NO_CLASS } from '@/utils/styles';
import { YARD_NAME } from '@/utils/constants';
import { useYardChecks } from '@/hooks';
import { useYardCheckEvents } from '@/hooks/usePusher';
import { SearchInput, BottomSheet } from '@/components/ui';
import { YardCheckModal, type YardCheckModalMode } from '@/components/yardcheck/YardCheckModal';
import { PlateIcon } from '@/components/yardcheck/PlateIcon';
import Link from 'next/link';
import {
  MoreVertical,
  Trash2,
  Pencil,
  Package,
  Plus,
  ScanLine,
  Copy,
  Check,
  ClipboardCheck,
} from 'lucide-react';

// Builds the plain-text "yard update" report pasted into LINE: assets
// currently physically IN the yard (not the broader "needs action" set used
// elsewhere on this page), grouped by type, oldest-in-yard first so the
// longest-dwelling containers are the first thing anyone reads.
function buildYardUpdateReport(checks: YardCheck[]): string {
  const now = new Date();
  const inNow = checks.filter((c) => c.yard_status === 'in');

  const byType = (type: YardCheckType) =>
    inNow
      .filter((c) => c.type === type)
      .slice()
      .sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime());

  const emptyList = byType('empty');
  const ladenList = byType('laden');
  const chassisList = byType('chassis');

  const elapsedHm = (at: string | Date) => {
    const totalMinutes = Math.max(0, Math.floor((now.getTime() - new Date(at).getTime()) / 60000));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h, ${m}m`;
  };

  const emptyStatusLabel = (c: YardCheck) => {
    const status = getYardEmptyDisplayStatus(c);
    if (status === 'passed') return 'PASSED';
    if (status === 'failed') return 'NOT PASSED';
    return 'PENDING';
  };

  const containerLine = (c: YardCheck) => {
    const at = c.checked_at;
    const statusPart = c.type === 'empty' ? ` | ${emptyStatusLabel(c)}` : '';
    return `${c.container_no} | ${c.size}${statusPart} | IN ${formatDateTime(at)} (${elapsedHm(at)})`;
  };

  const chassisLine = (c: YardCheck) => {
    const at = c.checked_at;
    return `${c.chassis_plate} | IN ${formatDateTime(at)} (${elapsedHm(at)})`;
  };

  const lines: string[] = [
    `FLS YARD UPDATE | ${formatDate(now)} ${formatTime(now)}`,
    `Yard: ${YARD_NAME}`,
    `TOTAL IN YARD: ${inNow.length}`,
    '',
    `EMPTY (${emptyList.length})`,
    ...emptyList.map(containerLine),
    '',
    `LADEN (${ladenList.length})`,
    ...ladenList.map(containerLine),
    '',
    `CHASSIS (${chassisList.length})`,
    ...chassisList.map(chassisLine),
  ];

  return lines.join('\n');
}

export default function YardCheckSummaryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-80px)]"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#006cb3]" /></div>}>
      <YardCheckSummaryContent />
    </Suspense>
  );
}

function YardCheckSummaryContent() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilters, setTypeFilters] = useState<Set<YardCheckType>>(new Set());
  const [activeTab, setActiveTab] = useState<'in' | 'out'>('in');
  const [inStatusFilter, setInStatusFilter] = useState<'passed' | 'not_passed' | 'pending' | null>(null);
  const [outRange, setOutRange] = useState<'24h' | '7d' | 'all'>('24h');
  const [actionCheck, setActionCheck] = useState<YardCheck | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCheck, setDeletingCheck] = useState<YardCheck | null>(null);
  const [markOutCheck, setMarkOutCheck] = useState<YardCheck | null>(null);

  const [modalMode, setModalMode] = useState<YardCheckModalMode>('update');
  const [modalOpen, setModalOpen] = useState(false);
  const [initialInspect, setInitialInspect] = useState<YardCheck | null>(null);
  const [initialEdit, setInitialEdit] = useState<YardCheck | null>(null);
  const [initialView, setInitialView] = useState<YardCheck | null>(null);
  const [copied, setCopied] = useState(false);

  // Draggable Create FAB (like iOS AssistiveTouch) - a fixed bottom-right spot
  // always risks sitting over whatever the last list item happens to be, so
  // instead of padding the list to dodge it, let people drag it out of the way
  // and remember where they left it.
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabPos, setFabPos] = useState<{ right: number; bottom: number }>({ right: 16, bottom: 20 });
  const [isDraggingFab, setIsDraggingFab] = useState(false);
  const fabDragRef = useRef<{ startX: number; startY: number; startRight: number; startBottom: number; moved: boolean } | null>(null);
  // A completed drag ends with a pointerup, which the browser follows with a
  // compatibility click on touch devices - without this flag that click would
  // immediately open Create right after a drag, and on some touch sequences
  // land on the freshly-opened modal's backdrop and close it in the same beat.
  const fabJustDraggedRef = useRef(false);

  const clampFabPos = useCallback((right: number, bottom: number) => {
    const container = containerRef.current;
    const fabSize = 56;
    if (!container) return { right, bottom };
    const maxRight = Math.max(0, container.clientWidth - fabSize);
    const maxBottom = Math.max(0, container.clientHeight - fabSize);
    return { right: Math.min(Math.max(right, 0), maxRight), bottom: Math.min(Math.max(bottom, 0), maxBottom) };
  }, []);

  // Restore the saved spot, but clamp it immediately - a position saved on a
  // wide screen can be well outside a narrower one.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('yc_fab_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.right === 'number' && typeof parsed.bottom === 'number') {
          setFabPos(clampFabPos(parsed.right, parsed.bottom));
        }
      }
    } catch { /* ignore invalid saved position */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-clamp whenever the container is resized (orientation change, window
  // resize, sidebar toggling, etc.) so the FAB can never end up stranded
  // off-screen with no way to drag it back.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      setFabPos((prev) => clampFabPos(prev.right, prev.bottom));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [clampFabPos]);

  const handleFabPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    fabDragRef.current = { startX: e.clientX, startY: e.clientY, startRight: fabPos.right, startBottom: fabPos.bottom, moved: false };
    setIsDraggingFab(true);
    // A new gesture starting means any stray compatibility click from the
    // *previous* drag has already landed (or never will) - whatever click
    // eventually comes from *this* gesture is a fresh interaction, not a
    // leftover one, so it must never be suppressed by the old flag.
    fabJustDraggedRef.current = false;
  };

  const handleFabPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = fabDragRef.current;
    if (!drag) return;
    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) drag.moved = true;
    setFabPos(clampFabPos(drag.startRight - deltaX, drag.startBottom - deltaY));
  };

  // Pointerup and pointercancel only ever settle drag state - they never open
  // Create themselves. Opening happens in the real onClick handler below, so
  // mouse, touch, keyboard (Enter/Space) and assistive activation all go
  // through the same normal button-click path.
  const endFabDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    const drag = fabDragRef.current;
    fabDragRef.current = null;
    setIsDraggingFab(false);
    if (drag?.moved) {
      fabJustDraggedRef.current = true;
      // The next pointerdown or keydown clears this immediately (see below),
      // so this timeout only matters for the narrow case of switching
      // straight from a touch drag to keyboard activation with neither of
      // those firing first - a fallback, not the primary reset path.
      window.setTimeout(() => { fabJustDraggedRef.current = false; }, 300);
      setFabPos((prev) => {
        try { localStorage.setItem('yc_fab_pos', JSON.stringify(prev)); } catch { /* ignore */ }
        return prev;
      });
    }
  };

  const handleFabClick = () => {
    if (fabJustDraggedRef.current) {
      fabJustDraggedRef.current = false;
      return;
    }
    openModal('create');
  };

  const { checks, loading, refetch, markOut, deleteCheck, actionLoading } = useYardChecks({});

  // Real-time: any create/update/mark-out/delete from any client refetches
  // this list, so a page left open stays in sync without a manual refresh.
  useYardCheckEvents(refetch);

  // Deep link: /yardcheck/summary?inspect=<id> opens the checklist directly.
  // Read-only visitors can't submit an inspection anyway, so skip this entirely.
  useEffect(() => {
    const inspectId = searchParams.get('inspect');
    if (!inspectId || loading || !isAuthenticated) return;
    const record = checks.find((c) => c.id === inspectId);
    if (record) {
      setInitialInspect(record);
      setModalMode('update');
      setModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, isAuthenticated]);

  const toggleTypeFilter = (ty: YardCheckType) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(ty)) next.delete(ty);
      else next.add(ty);
      return next;
    });
  };

  const matchesFilters = useCallback((c: YardCheck) => {
    if (typeFilters.size > 0 && !typeFilters.has(c.type)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = `${c.container_no || ''} ${c.chassis_plate}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }, [typeFilters, searchQuery]);

  // Inspection-status pills (Passed / Not Passed / Pending) only make sense for
  // empty containers, and only narrow the IN tab — OUT keeps its own 24h/7d/all
  // range filter independent of this. Not Passed means "checked and failed",
  // distinct from Pending ("never checked yet") - they used to be lumped
  // together under Not Passed, which misrepresented untouched containers as
  // having failed an inspection they hadn't had yet.
  const matchesInStatus = useCallback((c: YardCheck) => {
    if (!inStatusFilter) return true;
    if (c.type !== 'empty') return false;
    const disp = getYardEmptyDisplayStatus(c);
    if (inStatusFilter === 'passed') return disp === 'passed';
    if (inStatusFilter === 'not_passed') return disp === 'failed';
    return disp === 'created'; // 'pending'
  }, [inStatusFilter]);

  // A record still needs action if it's physically in the yard (needs mark-out), or
  // if it's an empty container whose checklist isn't passed yet — even if it already
  // left, so checkers can go back and correct a wrong/incomplete inspection.
  const needsAction = useCallback((c: YardCheck) => {
    if (c.yard_status === 'in') return true;
    return c.type === 'empty' && getYardEmptyDisplayStatus(c) !== 'passed';
  }, []);

  const inYard = useMemo(
    () => checks.filter((c) => needsAction(c) && matchesFilters(c) && matchesInStatus(c)),
    [checks, matchesFilters, matchesInStatus, needsAction]
  );

  const outList = useMemo(() => {
    const now = Date.now();
    const rangeMs = outRange === '24h' ? 24 * 60 * 60 * 1000 : outRange === '7d' ? 7 * 24 * 60 * 60 * 1000 : null;
    return checks.filter((c) => {
      if (c.yard_status !== 'out') return false;
      if (!matchesFilters(c)) return false;
      if (rangeMs === null) return true;
      const outAt = c.updated_at ? new Date(c.updated_at) : new Date(c.checked_at);
      return now - outAt.getTime() <= rangeMs;
    });
  }, [checks, matchesFilters, outRange]);

  const stats = useMemo(() => {
    const emptyAction = checks.filter((c) => c.type === 'empty' && needsAction(c));
    const ladenAction = checks.filter((c) => c.type === 'laden' && needsAction(c));
    const chassisAction = checks.filter((c) => c.type === 'chassis' && needsAction(c));
    return {
      emptyTotal: emptyAction.length,
      emptyPassed: emptyAction.filter((c) => getYardEmptyDisplayStatus(c) === 'passed').length,
      emptyPending: emptyAction.filter((c) => getYardEmptyDisplayStatus(c) === 'created').length,
      emptyNotPassed: emptyAction.filter((c) => getYardEmptyDisplayStatus(c) === 'failed').length,
      ladenTotal: ladenAction.length,
      chassisTotal: chassisAction.length,
    };
  }, [checks, needsAction]);

  const confirmMarkOut = async () => {
    if (!markOutCheck) return;
    const ok = await markOut(markOutCheck);
    if (ok) setMarkOutCheck(null);
  };
  const cancelMarkOut = () => setMarkOutCheck(null);

  const handleDelete = async () => {
    if (!deletingCheck) return;
    const ok = await deleteCheck(deletingCheck);
    if (ok) {
      setShowDeleteModal(false);
      setDeletingCheck(null);
    }
  };
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingCheck(null);
  };

  const handleCopyYardUpdate = async () => {
    const text = buildYardUpdateReport(checks);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert(text);
    }
  };

  const openModal = (mode: YardCheckModalMode) => {
    setInitialInspect(null);
    setInitialEdit(null);
    setInitialView(null);
    setModalMode(mode);
    setModalOpen(true);
  };

  const openEditModal = (check: YardCheck) => {
    setInitialInspect(null);
    setInitialView(null);
    setInitialEdit(check);
    setModalMode('update');
    setModalOpen(true);
  };

  const openViewModal = (check: YardCheck) => {
    setInitialInspect(null);
    setInitialEdit(null);
    setInitialView(check);
    setModalMode('update');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setInitialInspect(null);
    setInitialEdit(null);
    setInitialView(null);
    if (searchParams.get('inspect')) {
      window.history.replaceState(null, '', '/yardcheck/summary');
    }
  };


  const getCardBorder = (c: YardCheck) => {
    if (c.type === 'empty') {
      const disp = getYardEmptyDisplayStatus(c);
      return disp === 'passed' ? 'border-l-emerald-500' : disp === 'failed' ? 'border-l-red-500' : 'border-l-amber-400';
    }
    if (c.type === 'laden') return 'border-l-emerald-500';
    return 'border-l-violet-500';
  };

  const renderInYardCard = (c: YardCheck) => {
    const disp = c.type === 'empty' ? getYardEmptyDisplayStatus(c) : null;
    const hasNg = c.type === 'empty' && (c.checklist || []).some((item) => item.result === 'fail');
    const statusLabel = disp === 'passed' ? t('yc_passed') : disp === 'failed' ? t('yc_failed') : disp === 'created' ? t('yc_pending') : null;

    return (
      <div key={c.id} data-yard-record={c.id} className={`overflow-hidden rounded-xl border border-slate-200 border-l-[3px] bg-white shadow-sm ${getCardBorder(c)}`}>
        {/* Row 1: type + id + size + chassis + menu */}
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 min-w-0 flex-1">
            <span className={`text-[11px] font-semibold tracking-wide px-1.5 py-0.5 rounded shrink-0 ${getYardCardTypeBadgeClass(c.type)}`}>
              {t(`yc_type_${c.type}`).toUpperCase()}
            </span>
            <span className="font-mono text-sm font-semibold text-gray-900 flex items-center gap-1 w-[94px] shrink-0">
              <PlateIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="tabular-nums truncate">{c.chassis_plate}</span>
            </span>
            {c.size && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${getYardCardSizeBadgeClass(c.type)}`}>{c.size}</span>}
            {c.container_no && (
              <span className={`text-xs font-medium break-all ${YARD_CARD_CONTAINER_NO_CLASS}`}>{c.container_no}</span>
            )}
            {c.type === 'chassis' && <span className="text-[10px] text-gray-400">{t('yc_no_container')}</span>}
            {c.yard_status === 'out' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-semibold shrink-0">
                {t('yc_departed_label')}
              </span>
            )}
          </div>
          {isAuthenticated && (
            <button aria-label={`${t('yc_edit_record')} ${c.container_no || c.chassis_plate}`} onClick={() => setActionCheck(actionCheck?.id === c.id ? null : c)} className="flex h-11 w-11 items-center justify-center hover:bg-slate-100 rounded-lg text-slate-500 shrink-0">
              <MoreVertical className="w-4 h-4" />
            </button>
          )}
        </div>

        {c.yard_status === 'out' && disp !== 'passed' && (
          <div className="px-3 pt-1">
            <p className="text-xs text-amber-700">{t('yc_already_out_hint')}</p>
          </div>
        )}

        {hasNg && (
          <div className="px-3 pt-1">
            <p className="text-xs text-red-600">
              ⚠ {(c.checklist || []).filter((i) => i.result === 'fail').map((i) => i.item).join(', ')}
              {c.ng_detail ? ` · ${c.ng_detail}` : ''}
            </p>
          </div>
        )}

        {/* Row 2: status + time + action */}
        <div className={`flex items-center justify-between gap-2 px-3 py-1.5 mt-1 ${
          hasNg ? 'bg-red-50' : disp === 'passed' ? 'bg-emerald-50' : disp === 'failed' ? 'bg-red-50' : disp === 'created' ? 'bg-amber-50' : 'bg-gray-50'
        }`}>
          <span className={`min-w-0 text-xs font-medium ${
            disp === 'passed' ? 'text-emerald-700' : disp === 'failed' ? 'text-red-700' : disp === 'created' ? 'text-amber-800' : 'text-slate-500'
          }`}>
            {statusLabel ? `${statusLabel} · ` : ''}{formatDateTimeRelative(c.checked_at)}
          </span>
          {isAuthenticated && (disp && disp !== 'passed' ? (
            <button
              onClick={() => { setInitialInspect(c); setModalMode('update'); setModalOpen(true); }}
              className={`shrink-0 min-h-9 text-center text-xs px-3 py-1.5 rounded-lg text-white font-medium ${
                hasNg ? 'bg-amber-700 hover:bg-amber-800' : 'bg-[#006cb3] hover:bg-[#00568f]'
              }`}
            >
              {hasNg ? t('yc_reinspect') : t('yc_awaiting_inspection')}
            </button>
          ) : (
            <button
              onClick={() => setMarkOutCheck(c)}
              disabled={actionLoading}
              className="shrink-0 min-h-9 text-center text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-white font-medium disabled:opacity-50"
            >
              {t('yc_mark_out')}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="fls-yard-summary mx-auto flex max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 h-[calc(100dvh-104px)] min-h-[360px] relative">
      <div className="shrink-0 border-b border-slate-200 bg-white p-3">
        <h1 className="sr-only">{t('yc_summary')}</h1>
        <div data-testid="yard-toolbar" className="space-y-2 lg:grid lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:items-center lg:gap-3 lg:space-y-0">
          <div className="grid grid-cols-3 gap-2">
            {([{ type: 'empty', count: stats.emptyTotal }, { type: 'laden', count: stats.ladenTotal }, { type: 'chassis', count: stats.chassisTotal }] as const).map(({ type, count }) => (
              <button key={type} onClick={() => toggleTypeFilter(type)} aria-pressed={typeFilters.has(type)} className={`flex min-h-11 min-w-0 items-center justify-between gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors ${typeFilters.has(type) ? 'border-[#006cb3] bg-blue-50 text-[#006cb3] ring-1 ring-[#006cb3]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                <span className="min-w-0 break-words">{t(`yc_type_${type}`)}</span><span className="text-base tabular-nums text-[#006cb3]">{count}</span>
              </button>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={t('search_placeholder')} ringColor="focus:ring-[#006cb3]" className="min-w-0 [&_input]:h-11" />
            <button onClick={handleCopyYardUpdate} aria-label={t('yc_copy_yard_update')} title={t('yc_copy_yard_update')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-[#006cb3] hover:bg-blue-50">{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button>
            {isAuthenticated && (
              <button onClick={() => openModal('update')} aria-label={t('yc_scan_container')} title={t('yc_scan_container')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-[#006cb3] hover:bg-blue-50"><ScanLine className="h-4 w-4" /></button>
            )}
            {isAuthenticated && (
              <Link href="/yardcheck/inventory-check" aria-label={t('yc_inv_title')} title={t('yc_inv_title')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-[#006cb3] hover:bg-blue-50"><ClipboardCheck className="h-4 w-4" /></Link>
            )}
          </div>
          <div className="flex min-w-0 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            {(['in', 'out'] as const).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} aria-pressed={activeTab === tab} className={`min-h-10 min-w-0 flex-1 rounded-md px-1 text-xs font-semibold ${activeTab === tab ? 'bg-[#006cb3] text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>{t(tab === 'in' ? 'yc_in_yard_section' : 'yc_out_today_section')} {tab === 'in' ? inYard.length : outList.length}</button>)}
          </div>
        </div>

        {/* Quick filter pills - one tap, not a dropdown, since speed matters more here than compactness */}
        {activeTab === 'in' ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {([
              { key: null, label: t('all') },
              { key: 'passed', label: `${t('yc_passed')} ${stats.emptyPassed}` },
              { key: 'not_passed', label: `${t('yc_not_passed')} ${stats.emptyNotPassed}` },
              { key: 'pending', label: `${t('yc_awaiting_inspection')} ${stats.emptyPending}` },
            ] as const).map((f) => (
              <button
                key={f.label}
                onClick={() => setInStatusFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  inStatusFilter === f.key ? 'bg-[#006cb3] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(['24h', '7d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setOutRange(range)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  outRange === range ? 'bg-[#006cb3] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t(`yc_range_${range}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 px-3 py-3 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#006cb3]" />
          </div>
        ) : activeTab === 'in' ? (
          inYard.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-6 bg-white rounded-lg border border-gray-200">
              {t('yc_no_records')}
            </div>
          ) : (
            <div className="space-y-2">
              {inYard.map(renderInYardCard)}
            </div>
          )
        ) : outList.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-6 bg-gray-50 rounded-lg border border-gray-200">
            {t('yc_no_records')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {outList.map((c) => {
              const canView = c.type === 'empty';
              const Row = canView ? 'button' : 'div';
              return (
                <Row
                  key={c.id}
                  onClick={canView ? () => openViewModal(c) : undefined}
                  className={`w-full flex flex-wrap items-center gap-2 px-3 py-3 text-xs text-left ${canView ? 'hover:bg-gray-100' : ''}`}
                >
                  <span className={`text-[9px] px-1 py-0.5 rounded font-semibold shrink-0 w-14 text-center ${getYardCardTypeBadgeClass(c.type)}`}>
                    {t(`yc_type_${c.type}`)}
                  </span>
                  <span className="font-mono font-medium text-gray-700 flex items-center gap-1 w-[94px] shrink-0">
                    <PlateIcon className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="tabular-nums truncate">{c.chassis_plate}</span>
                  </span>
                  <span className={`min-w-24 flex-1 break-all font-mono font-medium ${YARD_CARD_CONTAINER_NO_CLASS}`}>{c.container_no || ''}</span>
                  <span className="text-gray-400 shrink-0">{c.size || '—'}</span>
                  <span className="text-gray-400 shrink-0 text-right">{formatDateTimeRelative(c.updated_at || c.checked_at)}</span>
                </Row>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating create button - draggable like iOS AssistiveTouch, so it can
          be moved off whatever it's covering instead of always sitting in a
          fixed corner that may land on the last list item's own buttons */}
      {isAuthenticated && (
        <button
          onPointerDown={handleFabPointerDown}
          onPointerMove={handleFabPointerMove}
          onPointerUp={endFabDrag}
          onPointerCancel={endFabDrag}
          onClick={handleFabClick}
          onKeyDown={() => { fabJustDraggedRef.current = false; }}
          style={{ right: fabPos.right, bottom: fabPos.bottom, touchAction: 'none' }}
          aria-label={t('yc_mode_create')}
          title={t('yc_mode_create')}
          className={`absolute z-30 flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-[#006cb3] text-white shadow-xl hover:bg-[#00568f] ${isDraggingFab ? 'scale-105' : ''}`}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Create/Update modal */}
      <YardCheckModal
        startWithScanner={modalMode === 'update' && !initialInspect && !initialEdit && !initialView}
        isOpen={modalOpen}
        mode={modalMode}
        onClose={closeModal}
        onSaved={refetch}
        initialInspect={initialInspect}
        initialEdit={initialEdit}
        initialView={initialView}
      />

      {/* Action sheet */}
      <BottomSheet
        isOpen={!!actionCheck}
        onClose={() => setActionCheck(null)}
        title={actionCheck ? (actionCheck.container_no || actionCheck.chassis_plate) : ''}
        cancelLabel={t('cc_cancel')}
      >
        {actionCheck && (
          <>
            <button
              onClick={() => { openEditModal(actionCheck); setActionCheck(null); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-700 text-sm"
            >
              <Pencil className="w-4 h-4" />
              {t('yc_edit_record')}
            </button>
            <button
              onClick={() => { setDeletingCheck(actionCheck); setShowDeleteModal(true); setActionCheck(null); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-red-50 text-red-600 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              {t('delete') || 'Delete'}
            </button>
          </>
        )}
      </BottomSheet>

      {/* Mark OUT confirm */}
      {markOutCheck && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={cancelMarkOut}
        >
          <div className="bg-white rounded-xl p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-2">
              <PlateIcon className="w-4 h-4 text-gray-700" />
              {markOutCheck.chassis_plate}{markOutCheck.container_no ? ` · ${markOutCheck.container_no}` : ''}
            </p>
            <p className="text-xs text-gray-500 mb-4">{t('yc_confirm_mark_out_body')}</p>
            <div className="flex gap-2">
              <button type="button" onClick={cancelMarkOut} className="flex-1 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                {t('cc_cancel')}
              </button>
              <button type="button" onClick={confirmMarkOut} disabled={actionLoading} className="flex-1 py-2 rounded-lg text-xs font-medium bg-slate-700 text-white disabled:opacity-50">
                {actionLoading ? '...' : t('yc_mark_out')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteModal && deletingCheck && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={cancelDelete}
        >
          <div className="bg-white rounded-xl p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-2">
              <Package className="w-4 h-4 text-red-500" />
              {deletingCheck.container_no || deletingCheck.chassis_plate}
            </p>
            <p className="text-xs text-gray-500 mb-4">Delete this record?</p>
            <div className="flex gap-2">
              <button type="button" onClick={cancelDelete} className="flex-1 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                {t('cc_cancel')}
              </button>
              <button type="button" onClick={handleDelete} disabled={actionLoading} className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-500 text-white disabled:opacity-50">
                {actionLoading ? '...' : t('delete') || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

