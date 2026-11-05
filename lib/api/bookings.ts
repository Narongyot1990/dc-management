// =============================================
// Bookings API
// =============================================

import { api } from './client';
import { API_ENDPOINTS } from '@/utils/constants';
import type { Booking, BookingFormData, BookingStatus } from '@/types';

interface BookingQuery {
  search?: string;
  status?: BookingStatus;
  container?: string;
}

/**
 * Fetch bookings with optional filters
 */
export async function getBookings(query?: BookingQuery) {
  return api.get<Booking[]>(API_ENDPOINTS.BOOKINGS, query as Record<string, string>);
}

/**
 * Get booking by ID
 */
export async function getBooking(id: string) {
  return api.get<Booking>(`${API_ENDPOINTS.BOOKINGS}/${id}`);
}

/**
 * Create new booking
 */
export async function createBooking(data: BookingFormData) {
  return api.post<Booking>(API_ENDPOINTS.BOOKINGS, data);
}

/**
 * Update booking
 */
export async function updateBooking(id: string, data: Partial<Booking>) {
  return api.put<Booking>(`${API_ENDPOINTS.BOOKINGS}/${id}`, data);
}

/**
 * Delete booking
 */
export async function deleteBooking(id: string) {
  return api.delete(`${API_ENDPOINTS.BOOKINGS}/${id}`);
}

/**
 * Link booking to job
 */
export async function linkBookingToJob(bookingId: string, jobId: string) {
  return api.put<Booking>(`${API_ENDPOINTS.BOOKINGS}/${bookingId}`, {
    job_id: jobId,
    status: 'in_progress',
  });
}

/**
 * Mark booking as complete
 */
export async function completeBooking(id: string) {
  return api.put<Booking>(`${API_ENDPOINTS.BOOKINGS}/${id}`, {
    status: 'completed',
    updated_at: new Date().toISOString(),
  });
}

/**
 * Mark booking as incomplete
 */
export async function markBookingIncomplete(id: string) {
  return api.put<Booking>(`${API_ENDPOINTS.BOOKINGS}/${id}`, {
    status: 'incomplete',
    updated_at: new Date().toISOString(),
  });
}
