// =============================================
// Pusher Server Configuration
// =============================================

import Pusher from 'pusher';

// Pusher instance (server-side)
let pusherInstance: Pusher | null = null;

export function getPusher(): Pusher {
  if (!pusherInstance) {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!appId || !key || !secret || !cluster) {
      console.warn('Pusher credentials not configured. Real-time features disabled.');
      // Return a mock pusher that does nothing
      return {
        trigger: async () => ({}),
      } as unknown as Pusher;
    }

    pusherInstance = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
  }

  return pusherInstance;
}

// =============================================
// Pusher Event Types
// =============================================

export const PUSHER_CHANNELS = {
  JOBS: 'jobs',
  BOOKINGS: 'bookings',
  DOCKS: 'docks',
} as const;

export const PUSHER_EVENTS = {
  // Job events
  JOB_CREATED: 'job:created',
  JOB_UPDATED: 'job:updated',
  JOB_COMPLETED: 'job:completed',
  JOB_ISSUE: 'job:issue',

  // Booking events
  BOOKING_CREATED: 'booking:created',
  BOOKING_UPDATED: 'booking:updated',
  BOOKING_LINKED: 'booking:linked',

  // Dock events
  DOCK_UPDATED: 'dock:updated',
} as const;

// =============================================
// Helper Functions to Trigger Events
// =============================================

interface JobEventData {
  id: string;
  type: string;
  container_no: string;
  dock_from?: string;
  dock_to?: string;
  status: string;
  driver_id?: string;
  priority?: number;
}

interface BookingEventData {
  id: string;
  booking_no: string;
  container_no: string;
  status: string;
  job_id?: string;
}

interface DockEventData {
  dock: string;
  occupied: boolean;
  containerNo?: string;
}

/**
 * Trigger job event
 */
export async function triggerJobEvent(
  event: typeof PUSHER_EVENTS[keyof typeof PUSHER_EVENTS],
  data: JobEventData
) {
  try {
    const pusher = getPusher();
    await pusher.trigger(PUSHER_CHANNELS.JOBS, event, data);
    console.log(`Pusher: ${event} triggered`, data.id);
  } catch (error) {
    console.error('Pusher trigger error:', error);
  }
}

/**
 * Trigger booking event
 */
export async function triggerBookingEvent(
  event: typeof PUSHER_EVENTS[keyof typeof PUSHER_EVENTS],
  data: BookingEventData
) {
  try {
    const pusher = getPusher();
    await pusher.trigger(PUSHER_CHANNELS.BOOKINGS, event, data);
    console.log(`Pusher: ${event} triggered`, data.id);
  } catch (error) {
    console.error('Pusher trigger error:', error);
  }
}

/**
 * Trigger dock event
 */
export async function triggerDockEvent(data: DockEventData) {
  try {
    const pusher = getPusher();
    await pusher.trigger(PUSHER_CHANNELS.DOCKS, PUSHER_EVENTS.DOCK_UPDATED, data);
    console.log(`Pusher: dock:updated triggered`, data.dock);
  } catch (error) {
    console.error('Pusher trigger error:', error);
  }
}
