// =============================================
// Style Utilities
// =============================================

import { STATUS_COLORS, BADGE_COLORS, VENDOR_COLORS, CC_STATUS_COLORS, YARD_TYPE_COLORS, YARD_STATUS_COLORS, YARD_INSPECTION_COLORS } from './constants';
import type { BookingStatus, JobStatus, YardCheck } from '@/types';

/**
 * Get border color class for booking status
 */
export function getBookingStatusColor(status: BookingStatus): string {
  return STATUS_COLORS.booking[status] || STATUS_COLORS.booking.pending;
}

/**
 * Get badge color class for job status
 */
export function getJobStatusColor(status: JobStatus): string {
  return STATUS_COLORS.job[status] || STATUS_COLORS.job.pending;
}

/**
 * Get dock status color
 */
export function getDockStatusColor(isOccupied: boolean): string {
  return isOccupied ? STATUS_COLORS.dock.occupied : STATUS_COLORS.dock.available;
}

/**
 * Get badge color for any status
 */
export function getBadgeColor(status: string): string {
  return BADGE_COLORS[status as keyof typeof BADGE_COLORS] || BADGE_COLORS.pending;
}

/**
 * Get vendor badge color for container check
 */
export function getVendorColor(vendor: string): string {
  return VENDOR_COLORS[vendor] || VENDOR_COLORS.Other;
}

/**
 * Get container check status colors (badge bg + border)
 */
export function getCCStatusColor(status: string): { bg: string; border: string } {
  return CC_STATUS_COLORS[status] || { bg: 'bg-gray-50 text-gray-600', border: 'border-l-gray-300' };
}

/**
 * Get yard check type badge color (empty/laden/chassis)
 */
export function getYardTypeColor(type: string): string {
  return YARD_TYPE_COLORS[type] || YARD_TYPE_COLORS.empty;
}

/**
 * Get yard check yard-status badge color (in/out)
 */
export function getYardStatusColor(status: string): string {
  return YARD_STATUS_COLORS[status] || YARD_STATUS_COLORS.out;
}

/**
 * Get yard check inspection-status badge color (pending/passed)
 */
export function getYardInspectionColor(status: string): string {
  return YARD_INSPECTION_COLORS[status] || YARD_INSPECTION_COLORS.pending;
}

/**
 * Derived 3-way display status for an empty-container yard check:
 * - 'created': checklist not started yet
 * - 'passed': all 5 items passed
 * - 'failed': checklist started/attempted but not all passed
 */
export function getYardEmptyDisplayStatus(c: YardCheck): 'created' | 'passed' | 'failed' {
  const hasFail = (c.checklist || []).some((i) => i.result === 'fail');
  if (hasFail) return 'failed';
  if (c.inspection_status === 'passed') return 'passed';
  return 'created';
}

/**
 * Combine class names (simple cn utility)
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get input state classes
 */
export function getInputClasses(hasError?: boolean, isSuccess?: boolean): string {
  const base = 'w-full border rounded-lg px-3 md:px-4 py-2 text-sm md:text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2';

  if (hasError) {
    return `${base} border-red-500 focus:ring-red-500`;
  }
  if (isSuccess) {
    return `${base} border-green-500 focus:ring-green-500 bg-green-50`;
  }
  return `${base} border-gray-300 focus:ring-blue-500`;
}

/**
 * Get button classes by variant
 */
export function getButtonClasses(
  variant: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' = 'primary',
  size: 'sm' | 'md' | 'lg' = 'md'
): string {
  const base = 'font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  };

  return `${base} ${variants[variant]} ${sizes[size]}`;
}
