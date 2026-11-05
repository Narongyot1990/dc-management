"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Booking, BookingStatus, ApiResponse } from '@/types';
import { API_ENDPOINTS } from '@/utils/constants';

interface UseBookingsOptions {
  status?: BookingStatus | BookingStatus[];
  autoFetch?: boolean;
}

interface UseBookingsReturn {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  searchBookings: (query: string) => Booking[];
  getBookingByContainer: (containerNo: string) => Booking | undefined;
}

/**
 * Custom hook for managing bookings data
 */
export function useBookings(options: UseBookingsOptions = {}): UseBookingsReturn {
  const { status, autoFetch = true } = options;

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();

      if (status) {
        // Support multiple statuses
        const statuses = Array.isArray(status) ? status : [status];

        // Fetch all statuses in parallel
        const responses = await Promise.all(
          statuses.map(s =>
            fetch(`${API_ENDPOINTS.BOOKINGS}?status=${s}`)
          )
        );

        const results = await Promise.all(
          responses.map(r => r.json())
        );

        // Combine all results
        const combined: Booking[] = [];
        results.forEach((data: ApiResponse<Booking[]>) => {
          if (data.success && data.data) {
            combined.push(...data.data);
          }
        });

        setBookings(combined);
      } else {
        // Fetch all
        const response = await fetch(API_ENDPOINTS.BOOKINGS);
        const data: ApiResponse<Booking[]> = await response.json();

        if (data.success && data.data) {
          setBookings(data.data);
        } else {
          throw new Error(data.error || 'Failed to fetch bookings');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('useBookings error:', err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Auto fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchBookings();
    }
  }, [autoFetch, fetchBookings]);

  // Search bookings locally (from cache)
  const searchBookings = useCallback((query: string): Booking[] => {
    if (!query) return bookings;

    const lowerQuery = query.toLowerCase();
    return bookings.filter(b =>
      b.container_no.toLowerCase().includes(lowerQuery) ||
      b.booking_no.toLowerCase().includes(lowerQuery) ||
      b.vendor_name.toLowerCase().includes(lowerQuery) ||
      b.truck_plate.toLowerCase().includes(lowerQuery)
    );
  }, [bookings]);

  // Get booking by container number
  const getBookingByContainer = useCallback((containerNo: string): Booking | undefined => {
    return bookings.find(
      b => b.container_no.toLowerCase() === containerNo.toLowerCase()
    );
  }, [bookings]);

  return {
    bookings,
    loading,
    error,
    refetch: fetchBookings,
    searchBookings,
    getBookingByContainer,
  };
}
