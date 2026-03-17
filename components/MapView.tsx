'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { IDeliveryOrder, IShipmentBooking } from '@/types';

export interface BranchData {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

export type MapFilter = 'all' | 'do' | 'draft' | 'loading' | 'enroute' | 'done';

interface MatchedDO {
  record: IDeliveryOrder;
  booking?: IShipmentBooking;
  lat: number;
  lon: number;
  branchCode: string;
  branchName: string;
}

interface MatchedBooking {
  booking: IShipmentBooking;
  lat: number;
  lon: number;
  branchCode: string;
  branchName: string;
}

interface RouteData {
  id: string;
  coordinates: [number, number][];
  distance: number;
  duration: number;
}

type BookingStatus = 'waiting' | 'loading' | 'enroute' | 'done';

function getBookingStatus(b: IShipmentBooking): BookingStatus {
  if (b.status === 'fulfilled') return 'done';
  if (b.loading_end) return 'enroute';
  // Only show 'loading' if both loading_start AND dock_number are set
  if (b.loading_start && b.dock_number) return 'loading';
  return 'waiting';
}

const STATUS_COLORS: Record<BookingStatus, { bg: string; border: string; route: string }> = {
  waiting:  { bg: '#6b7280', border: '#fff',  route: '#6b7280' },
  loading:  { bg: '#f59e0b', border: '#fff',  route: '#f59e0b' },
  enroute:  { bg: '#2563eb', border: '#fff',  route: '#2563eb' },
  done:     { bg: '#16a34a', border: '#fff',  route: '#16a34a' },
};

const HEADER_COLORS: Record<BookingStatus, string> = {
  waiting: '#6b7280',
  loading: '#f59e0b',
  enroute: '#2563eb',
  done:    '#16a34a',
};

const ORIGIN: [number, number] = [14.236652, 100.693546];

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Lazy-init DivIcon factory to avoid SSR issues
let _L: typeof import('leaflet') | null = null;
let _iconsReady = false;

function ensureLeaflet() {
  if (_iconsReady) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _L = require('leaflet') as typeof import('leaflet');
  _iconsReady = true;
}

function makeOriginIcon() {
  if (!_L) return undefined;
  return _L.divIcon({
    className: '',
    html: `<div style="
      background:#dc2626;color:#fff;font-weight:700;font-size:11px;
      width:36px;height:36px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);
    ">DC</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function makeStatusIcon(code: string, status: BookingStatus) {
  if (!_L) return undefined;
  const c = STATUS_COLORS[status];
  const w = Math.max(32, code.length * 9 + 12);
  return _L.divIcon({
    className: '',
    html: `<div style="
      background:${c.bg};color:#fff;font-weight:700;font-size:10px;
      padding:3px 6px;border-radius:12px;white-space:nowrap;
      border:2px solid ${c.border};box-shadow:0 2px 6px rgba(0,0,0,.3);
      text-align:center;line-height:1.3;
    ">${code}</div>`,
    iconSize: [w, 22],
    iconAnchor: [w / 2, 11],
    popupAnchor: [0, -14],
  });
}

function makeDraftIcon(code: string) {
  if (!_L) return undefined;
  const w = Math.max(32, code.length * 9 + 12);
  return _L.divIcon({
    className: '',
    html: `<div style="
      background:#9ca3af;color:#fff;font-weight:700;font-size:10px;
      padding:3px 6px;border-radius:12px;white-space:nowrap;
      border:2px dashed #fff;box-shadow:0 2px 8px rgba(156,163,175,.5);
      text-align:center;line-height:1.3;
    ">${code}</div>`,
    iconSize: [w, 22],
    iconAnchor: [w / 2, 11],
    popupAnchor: [0, -14],
  });
}

function PopupRow({ label, value, empty, bold, color }: { label: string; value: string; empty?: string; bold?: boolean; color?: string }) {
  const display = value?.trim() || '';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 400, textAlign: 'right', color: display ? (color || '#111827') : '#d1d5db' }}>
        {display || empty || '—'}
      </span>
    </div>
  );
}

function TimeRow({ label, ts, accentColor }: { label: string; ts?: string; accentColor: string }) {
  const timePart = ts ? (ts.split(' ')[1] || ts) : '';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
      <span style={{ color: '#6b7280', whiteSpace: 'nowrap', fontSize: 10 }}>{label}</span>
      {ts ? (
        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: accentColor, fontSize: 12 }}>
          {timePart}
        </span>
      ) : (
        <span style={{ color: '#d1d5db', fontSize: 10 }}>—</span>
      )}
    </div>
  );
}

interface MapViewProps {
  records: IDeliveryOrder[];
  branches: BranchData[];
  bookings?: IShipmentBooking[];
  loading?: boolean;
  filter?: MapFilter;
}

export default function MapView({ records, branches, bookings = [], loading, filter = 'all' }: MapViewProps) {
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const fetchedRef = useRef<string>('');
  const mapRef = useRef<LeafletMap | null>(null);

  // Init leaflet on mount
  useEffect(() => {
    ensureLeaflet();
    setReady(true);
  }, []);

  // Match by code first, then name fallback
  function matchBranch(dest: string): BranchData | undefined {
    if (!dest) return undefined;
    const byCode = branches.find((b) => b.code.toLowerCase() === dest.toLowerCase());
    if (byCode) return byCode;
    const codeMatch = dest.match(/\[([A-Z0-9]+)\]/i);
    if (codeMatch) {
      const found = branches.find((b) => b.code.toLowerCase() === codeMatch[1].toLowerCase());
      if (found) return found;
    }
    const byName = branches.find(
      (b) => b.name && (b.name === dest || dest.includes(b.name) || b.name.includes(dest))
    );
    return byName;
  }

  // Build a lookup: truck_plate → booking for enriching DO markers
  const bookingByPlate = new Map<string, IShipmentBooking>();
  for (const bk of bookings) {
    if (bk.truck_plate_head) bookingByPlate.set(bk.truck_plate_head.toLowerCase(), bk);
  }

  const matched: MatchedDO[] = [];
  const unmatched: IDeliveryOrder[] = [];

  for (const rec of records) {
    const dest = rec.destination_branch?.trim();
    if (!dest) { unmatched.push(rec); continue; }
    const branch = matchBranch(dest);
    if (branch) {
      const linkedBooking = rec.truck_plate_head ? bookingByPlate.get(rec.truck_plate_head.toLowerCase()) : undefined;
      matched.push({ record: rec, booking: linkedBooking, lat: branch.lat, lon: branch.lon, branchCode: branch.code, branchName: branch.name });
    } else {
      unmatched.push(rec);
    }
  }

  // Match bookings to branches (only those NOT already covered by a DO)
  const matchedCoords = new Set(matched.map((m) => `${m.lat},${m.lon}`));
  const draftBookings: MatchedBooking[] = [];
  for (const bk of bookings) {
    const dest = bk.destination_branch?.trim();
    if (!dest) continue;
    const branch = matchBranch(dest);
    if (branch) {
      const coordKey = `${branch.lat},${branch.lon}`;
      if (!matchedCoords.has(coordKey)) {
        draftBookings.push({ booking: bk, lat: branch.lat, lon: branch.lon, branchCode: branch.code, branchName: branch.name });
      }
    }
  }

  // Apply filter
  const filteredMatched = matched.filter((m) => {
    if (filter === 'all') return true;
    if (filter === 'do') return true; // all matched DOs
    if (filter === 'draft') return false;
    // status-based filters use the linked booking status
    const bk = m.booking;
    if (!bk) return filter === 'done'; // DO without booking = assume done
    const st = getBookingStatus(bk);
    if (filter === 'loading') return st === 'waiting' || st === 'loading';
    if (filter === 'enroute') return st === 'enroute';
    if (filter === 'done') return st === 'done';
    return true;
  });

  const filteredDrafts = filter === 'do' ? [] : (filter === 'all' || filter === 'draft') ? draftBookings : draftBookings.filter((d) => {
    const st = getBookingStatus(d.booking);
    if (filter === 'loading') return st === 'waiting' || st === 'loading';
    if (filter === 'enroute') return st === 'enroute';
    if (filter === 'done') return st === 'done';
    return true;
  });

  // Fit bounds when map is ready and we have points
  const fitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !_L) return;
    const points: [number, number][] = [
      ORIGIN,
      ...matched.map((m) => [m.lat, m.lon] as [number, number]),
      ...draftBookings.map((d) => [d.lat, d.lon] as [number, number]),
    ];
    if (points.length > 1) {
      const bounds = _L.latLngBounds(points.map((p) => _L!.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, draftBookings.length]);

  useEffect(() => {
    if (ready) fitBounds();
  }, [ready, fitBounds]);

  // Fetch routes for ALL destinations (matched DOs + draft bookings)
  useEffect(() => {
    const doKey = matched.map((m) => m.record._id).sort().join(',');
    const draftKey = draftBookings.map((d) => d.booking._id).sort().join(',');
    const combinedKey = `${doKey}|${draftKey}`;
    if (!combinedKey || combinedKey === '|' || combinedKey === fetchedRef.current) return;
    fetchedRef.current = combinedKey;

    const uniqueDests = new Map<string, { lat: number; lon: number }>();
    for (const m of matched) {
      const k = `${m.lat},${m.lon}`;
      if (!uniqueDests.has(k)) uniqueDests.set(k, { lat: m.lat, lon: m.lon });
    }
    for (const d of draftBookings) {
      const k = `${d.lat},${d.lon}`;
      if (!uniqueDests.has(k)) uniqueDests.set(k, { lat: d.lat, lon: d.lon });
    }

    async function fetchRoutes() {
      setRouteLoading(true);
      const results: RouteData[] = [];
      for (const [, dest] of uniqueDests) {
        try {
          const res = await fetch(
            `/api/directions?origin_lat=${ORIGIN[0]}&origin_lon=${ORIGIN[1]}&dest_lat=${dest.lat}&dest_lon=${dest.lon}`
          );
          if (res.ok) {
            const data = await res.json();
            results.push({
              id: `${dest.lat},${dest.lon}`,
              coordinates: data.coordinates,
              distance: data.distance,
              duration: data.duration,
            });
          }
        } catch (err) {
          console.error('Route fetch error:', err);
        }
      }
      setRoutes(results);
      setRouteLoading(false);
    }

    fetchRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched.map((m) => m.record._id).sort().join(','), draftBookings.map((d) => d.booking._id).sort().join(',')]);

  if (loading || !ready) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-xl">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <MapContainer
        center={ORIGIN}
        zoom={7}
        className="h-full w-full rounded-xl z-0"
        scrollWheelZoom={true}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Origin marker */}
        <Marker position={ORIGIN} icon={makeOriginIcon()}>
          <Popup>
            <strong>DC คลังสินค้า (Origin)</strong>
          </Popup>
        </Marker>

        {/* Matched DO markers — color by booking status */}
        {filteredMatched.map((m) => {
          const routeData = routes.find((r) => r.id === `${m.lat},${m.lon}`);
          const bk = m.booking;
          const status: BookingStatus = bk ? getBookingStatus(bk) : 'done';
          const headerBg = HEADER_COLORS[status];

          return (
            <Marker key={m.record._id} position={[m.lat, m.lon]} icon={makeStatusIcon(m.branchCode, status)}>
              <Popup>
                <div style={{ minWidth: 240, fontSize: 11, lineHeight: 1.6, fontFamily: 'system-ui, sans-serif' }}>
                  {/* Header — color-coded by status */}
                  <div style={{ background: headerBg, color: '#fff', margin: '-13px -20px 8px', padding: '8px 12px', borderRadius: '12px 12px 0 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{m.record.destination_branch}</span>
                      <span style={{ background: 'rgba(255,255,255,.25)', padding: '1px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700 }}>
                        {status === 'done' ? '✓ DONE' : status === 'enroute' ? '🚚 EN ROUTE' : status === 'loading' ? '📦 LOADING' : '⏳ WAITING'}
                      </span>
                    </div>
                    <div style={{ opacity: 0.85, fontSize: 10 }}>[{m.branchCode}] {m.branchName}</div>
                  </div>

                  {/* Document */}
                  <PopupRow label="DC" value={m.record.dc_number} />
                  <PopupRow label="Trip" value={m.record.trip_no} empty="—" />

                  {/* Vehicle & Driver */}
                  <div style={{ borderTop: '1px solid #e5e7eb', margin: '6px 0' }} />
                  <PopupRow label="🚛" value={`${m.record.truck_plate_head || ''}${m.record.truck_plate_tail ? ` / ${m.record.truck_plate_tail}` : ''}`} bold />
                  <PopupRow label="👤" value={m.record.driver_name} />
                  {bk?.dock_number && <PopupRow label="🔢 Dock" value={bk.dock_number} bold color="#4f46e5" />}

                  {/* Timeline — timestamps from linked booking */}
                  <div style={{ borderTop: '1px solid #e5e7eb', margin: '6px 0' }} />
                  <div style={{ background: '#f9fafb', borderRadius: 6, padding: '6px 8px' }}>
                    <TimeRow label="เริ่มโหลด" ts={bk?.loading_start} accentColor="#6366f1" />
                    <TimeRow label="โหลดเสร็จ" ts={bk?.loading_end} accentColor="#ea580c" />
                    <TimeRow label="ถึงสาขา" ts={bk?.arrival_branch} accentColor="#16a34a" />
                    <TimeRow label="ออกสาขา" ts={bk?.departure_branch} accentColor="#0d9488" />
                    <TimeRow label="กลับ DC" ts={bk?.return_dc} accentColor="#475569" />
                  </div>

                  {/* Plan */}
                  <div style={{ borderTop: '1px solid #e5e7eb', margin: '6px 0' }} />
                  <PopupRow label="📅 Plan" value={`${m.record.delivery_date || ''} ${m.record.delivery_time || ''}`} bold />

                  {/* Route info */}
                  {routeData && (
                    <div style={{ background: '#eff6ff', borderRadius: 6, padding: '4px 8px', marginTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb', fontWeight: 600 }}>
                        <span>{formatDistance(routeData.distance)}</span>
                        <span>{formatDuration(routeData.duration)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Draft booking markers */}
        {filteredDrafts.map((d) => {
          const draftRoute = routes.find((r) => r.id === `${d.lat},${d.lon}`);
          const status = getBookingStatus(d.booking);
          const headerBg = d.booking.loading_start ? HEADER_COLORS[status] : '#9ca3af';

          return (
            <Marker key={`draft-${d.booking._id}`} position={[d.lat, d.lon]} icon={d.booking.loading_start ? makeStatusIcon(d.branchCode, status) : makeDraftIcon(d.branchCode)}>
              <Popup>
                <div style={{ minWidth: 240, fontSize: 11, lineHeight: 1.6, fontFamily: 'system-ui, sans-serif' }}>
                  {/* Header */}
                  <div style={{ background: headerBg, color: '#fff', margin: '-13px -20px 8px', padding: '8px 12px', borderRadius: '12px 12px 0 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{d.booking.destination_branch}</span>
                      <span style={{ background: 'rgba(255,255,255,.25)', padding: '1px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700 }}>
                        {status === 'loading' ? '📦 LOADING' : status === 'enroute' ? '🚚 EN ROUTE' : 'DRAFT'}
                      </span>
                    </div>
                    <div style={{ opacity: 0.85, fontSize: 10 }}>[{d.branchCode}] {d.branchName}</div>
                  </div>

                  <PopupRow label="📅" value={d.booking.pickup_date} />
                  <PopupRow label="⏰" value={d.booking.pickup_time} empty="—" />
                  {d.booking.truck_plate_head && <PopupRow label="🚛" value={d.booking.truck_plate_head} bold />}
                  {d.booking.dock_number && <PopupRow label="🔢 Dock" value={d.booking.dock_number} bold color="#4f46e5" />}

                  {/* Timeline */}
                  <div style={{ borderTop: '1px solid #e5e7eb', margin: '6px 0' }} />
                  <div style={{ background: '#f9fafb', borderRadius: 6, padding: '6px 8px' }}>
                    <TimeRow label="เริ่มโหลด" ts={d.booking.loading_start} accentColor="#6366f1" />
                    <TimeRow label="โหลดเสร็จ" ts={d.booking.loading_end} accentColor="#ea580c" />
                    <TimeRow label="ถึงสาขา" ts={d.booking.arrival_branch} accentColor="#16a34a" />
                    <TimeRow label="ออกสาขา" ts={d.booking.departure_branch} accentColor="#0d9488" />
                    <TimeRow label="กลับ DC" ts={d.booking.return_dc} accentColor="#475569" />
                  </div>

                  {/* Route info */}
                  {draftRoute && (
                    <div style={{ background: '#fffbeb', borderRadius: 6, padding: '4px 8px', marginTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d97706', fontWeight: 600 }}>
                        <span>{formatDistance(draftRoute.distance)}</span>
                        <span>{formatDuration(draftRoute.duration)}</span>
                      </div>
                    </div>
                  )}

                  {!d.booking.loading_start && (
                    <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '4px 8px', marginTop: 6, textAlign: 'center', color: '#6b7280', fontWeight: 700, fontSize: 10 }}>
                      รอยิงใบงาน
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Route polylines — color by status */}
        {routes.map((route) => {
          const matchedDO = filteredMatched.find((m) => `${m.lat},${m.lon}` === route.id);
          const draftBk = filteredDrafts.find((d) => `${d.lat},${d.lon}` === route.id);
          const isDraft = !matchedDO && !!draftBk;

          let routeColor = '#6b7280';
          if (matchedDO) {
            const st = matchedDO.booking ? getBookingStatus(matchedDO.booking) : 'done';
            routeColor = STATUS_COLORS[st].route;
          } else if (draftBk) {
            const st = getBookingStatus(draftBk.booking);
            routeColor = STATUS_COLORS[st].route;
          }

          // Hide routes that don't match any visible marker
          if (!matchedDO && !draftBk) return null;

          return (
            <Polyline
              key={route.id}
              positions={route.coordinates}
              pathOptions={{
                color: routeColor,
                weight: isDraft ? 3 : 4,
                opacity: isDraft ? 0.6 : 0.7,
                dashArray: isDraft ? '8 6' : undefined,
              }}
            />
          );
        })}
      </MapContainer>

      {/* Route loading indicator */}
      {routeLoading && (
        <div className="absolute top-3 right-3 bg-white/90 rounded-lg px-3 py-1.5 shadow text-xs flex items-center gap-2 z-[1000]">
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600" />
          Loading routes...
        </div>
      )}

      {/* Unmatched records notice */}
      {unmatched.length > 0 && (
        <div className="absolute bottom-3 left-3 bg-amber-50/95 border border-amber-200 rounded-lg px-3 py-2 shadow text-xs z-[1000] max-w-[260px]">
          <div className="font-medium text-amber-800 mb-1">
            {unmatched.length} unmatched
          </div>
          <div className="text-amber-600 space-y-0.5">
            {unmatched.slice(0, 3).map((u) => (
              <div key={u._id} className="truncate">
                {u.dc_number} — {u.destination_branch || 'No branch'}
              </div>
            ))}
            {unmatched.length > 3 && <div>+{unmatched.length - 3} more</div>}
          </div>
        </div>
      )}
    </div>
  );
}
