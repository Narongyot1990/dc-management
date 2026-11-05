// =============================================
// Application Constants
// =============================================

/**
 * Dock list: D-01 to D-25 + F2
 */
export const DOCKS = [
  ...Array.from({ length: 25 }, (_, i) => `D-${String(i + 1).padStart(2, '0')}`),
  'F2'
] as const;

export type DockId = typeof DOCKS[number];

/**
 * Container Check Vendors
 */
export const CC_VENDORS = ['FLS', 'TMC', 'NNR', 'U-Globe', 'Other'] as const;

/**
 * Polling intervals (in milliseconds)
 */
export const POLLING_INTERVALS = {
  JOBS: 30000,      // 30 seconds - for job updates
  DOCKS: 60000,     // 60 seconds - for dock status
  BOOKINGS: 60000,  // 60 seconds - for booking list
} as const;

/**
 * Status colors for Tailwind CSS
 */
export const STATUS_COLORS = {
  // Booking status
  booking: {
    pending: 'border-l-gray-300',
    in_progress: 'border-l-yellow-500',
    completed: 'border-l-green-500',
    incomplete: 'border-l-orange-500',
  },
  // Job status
  job: {
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    issue: 'bg-red-100 text-red-800',
  },
  // Dock status
  dock: {
    available: 'bg-green-500',
    occupied: 'bg-red-500',
    reserved: 'bg-yellow-500',
  },
} as const;

/**
 * Container Check vendor colors
 */
export const VENDOR_COLORS: Record<string, string> = {
  FLS: 'bg-blue-100 text-blue-700',
  TMC: 'bg-purple-100 text-purple-700',
  NNR: 'bg-teal-100 text-teal-700',
  'U-Globe': 'bg-cyan-100 text-cyan-700',
  Other: 'bg-orange-100 text-orange-700',
};

/**
 * Container Check status colors (badge + border)
 */
export const CC_STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  pending: { bg: 'bg-amber-50 text-amber-700', border: 'border-l-amber-500' },
  loading: { bg: 'bg-blue-50 text-blue-700', border: 'border-l-blue-500' },
  loaded: { bg: 'bg-emerald-50 text-emerald-700', border: 'border-l-emerald-500' },
  departed: { bg: 'bg-slate-100 text-slate-600', border: 'border-l-slate-400' },
};

/**
 * Badge colors for status display
 */
export const BADGE_COLORS = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  incomplete: 'bg-orange-100 text-orange-700',
  issue: 'bg-red-100 text-red-700',
} as const;

/**
 * Job type icons
 */
export const JOB_ICONS = {
  in: '📥',
  out: '📤',
  swap: '🔄',
} as const;

/**
 * Purpose icons
 */
export const PURPOSE_ICONS = {
  for_loading: '📦',
  for_unloading: '📤',
} as const;

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  BOOKINGS: '/api/bookings',
  JOBS: '/api/jobs',
  JOBS_COUNT: '/api/jobs/count',
  JOBS_CHECK_DOCK: '/api/jobs/check-dock',
  BOOKING_SCAN: '/api/booking-scan',
  OCR: '/api/ocr',
  CONTAINER_CHECK: '/api/container-check',
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  LANGUAGE: 'app_language',
  USER_ID: 'user_id',
  THEME: 'app_theme',
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  PLANNER_ID: 'PLN001',  // TODO: Get from auth
  DRIVER_ID: 'DRV001',   // TODO: Get from auth
  LANGUAGE: 'th',
} as const;
