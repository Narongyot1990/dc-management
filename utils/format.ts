// =============================================
// Date & Time Formatting Utilities
// =============================================

/**
 * Get YYYY-MM-DD date string in Bangkok timezone
 * @param daysOffset - number of days to offset from today (default 0)
 */
export function getBangkokDateString(daysOffset = 0): string {
  const now = new Date();
  const bangkokDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  bangkokDate.setDate(bangkokDate.getDate() + daysOffset);
  const year = bangkokDate.getFullYear();
  const month = String(bangkokDate.getMonth() + 1).padStart(2, '0');
  const day = String(bangkokDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date using th-TH locale (e.g., "13/02 14:30")
 */
export function formatDateTimeTH(dateValue?: string | Date | null): string {
  if (!dateValue) return '-';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('th-TH', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Format date using th-TH locale with year (e.g., "13/02/2026 14:30")
 */
export function formatDateTimeFullTH(dateValue?: string | Date | null): string {
  if (!dateValue) return '-';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('th-TH', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Format time using th-TH locale (e.g., "14:30")
 */
export function formatTimeTH(dateValue?: string | Date | null): string {
  if (!dateValue) return '-';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Calculate duration between two dates (e.g., "15 min", "2h 30m")
 */
export function calculateDuration(startDate: string | Date, endDate: string | Date): string {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins} min`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format date to DD/MM HH:mm
 * @param dateString - Date string or Date object
 * @returns Formatted date string or '-' if invalid
 */
export function formatDateTime(dateString?: string | Date | null): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month} ${hours}:${minutes}`;
}

/**
 * Format date to DD/MM/YYYY
 * @param dateString - Date string or Date object
 * @returns Formatted date string
 */
export function formatDate(dateString?: string | Date | null): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format date to HH:mm
 * @param dateString - Date string or Date object
 * @returns Formatted time string
 */
export function formatTime(dateString?: string | Date | null): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

/**
 * Format date as "dd/mm/yyyy hh:mm (relative)" e.g. "06/11/2026 14:30 (14h)" or "(2d)"
 */
export function formatDateTimeRelative(dateValue?: string | Date | null): string {
  if (!dateValue) return '-';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) return '-';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let rel: string;
  if (diffMins < 1) rel = 'now';
  else if (diffHours < 1) rel = `${diffMins}m`;
  else if (diffDays < 1) rel = `${diffHours}h`;
  else rel = `${diffDays}d`;

  return `${day}/${month}/${year} ${hours}:${minutes} (${rel})`;
}

/**
 * Format date for datetime-local input
 * @param date - Date object
 * @returns ISO string formatted for input
 */
export function formatForInput(date?: Date | null): string {
  if (!date) return '';
  return date.toISOString().slice(0, 16);
}

/**
 * Get relative time (e.g., "2 hours ago" or compact: "2h")
 * @param dateString - Date string or Date object
 * @param compact - If true, returns short form ("2m", "5h") without "ago"
 * @returns Relative time string
 */
export function getRelativeTime(dateString?: string | Date | null, compact = false): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (compact) {
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return formatDateTimeTH(dateString);
  }

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(dateString);
}
