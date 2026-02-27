'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { IShipmentBooking } from '@/types';

interface CacheEntry {
  data: IShipmentBooking[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const STALE_MS = 10_000; // 10 seconds

interface UseBookingsReturn {
  bookings: IShipmentBooking[];
  loading: boolean;
  refresh: () => Promise<void>;
  lastUpdated: number | null;
}

export function useBookings(pickupDate: string): UseBookingsReturn {
  const [bookings, setBookings] = useState<IShipmentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const isMounted = useRef(true);

  const fetchBookings = useCallback(async (showLoading = true) => {
    if (!pickupDate) { setBookings([]); setLoading(false); return; }

    const cacheKey = pickupDate;
    const cached = cache.get(cacheKey);
    const now = Date.now();

    // Serve from cache immediately if fresh
    if (cached && now - cached.timestamp < STALE_MS && showLoading) {
      setBookings(cached.data);
      setLastUpdated(cached.timestamp);
      setLoading(false);
      return;
    }

    // Stale-while-revalidate: show cached data but still fetch
    if (cached && showLoading) {
      setBookings(cached.data);
      setLastUpdated(cached.timestamp);
      setLoading(false);
    } else if (showLoading) {
      setLoading(true);
    }

    try {
      const res = await fetch(`/api/shipment-bookings?pickup_date=${encodeURIComponent(pickupDate)}`);
      const json = await res.json();
      if (json.success && isMounted.current) {
        const data = json.data || [];
        cache.set(cacheKey, { data, timestamp: Date.now() });
        setBookings(data);
        setLastUpdated(Date.now());
      }
    } catch { /* silent */ }
    finally {
      if (isMounted.current) setLoading(false);
    }
  }, [pickupDate]);

  useEffect(() => {
    isMounted.current = true;
    fetchBookings();
    return () => { isMounted.current = false; };
  }, [fetchBookings]);

  // Refresh on window focus
  useEffect(() => {
    const handler = () => fetchBookings(false);
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [fetchBookings]);

  const refresh = useCallback(async () => {
    // Force refresh — bypass cache
    const cacheKey = pickupDate;
    cache.delete(cacheKey);
    await fetchBookings(true);
  }, [pickupDate, fetchBookings]);

  return { bookings, loading, refresh, lastUpdated };
}

/** Invalidate cache for a specific date (called after Pusher event) */
export function invalidateBookingsCache(pickupDate?: string) {
  if (pickupDate) {
    cache.delete(pickupDate);
  } else {
    cache.clear();
  }
}
