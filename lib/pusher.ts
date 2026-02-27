import Pusher from 'pusher';

let pusherInstance: Pusher | null = null;

export function getPusher(): Pusher {
  if (!pusherInstance) {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!appId || !key || !secret || !cluster) {
      console.warn('Pusher credentials not configured. Real-time features disabled.');
      return { trigger: async () => ({}) } as unknown as Pusher;
    }

    pusherInstance = new Pusher({ appId, key, secret, cluster, useTLS: true });
  }
  return pusherInstance;
}

export const PUSHER_CHANNEL = 'delivery-orders';
export const BOOKING_CHANNEL = 'shipment-bookings';

export const PUSHER_EVENTS = {
  DO_CREATED: 'do:created',
  DO_UPDATED: 'do:updated',
  DO_DELETED: 'do:deleted',
  BOOKING_CREATED: 'booking:created',
  BOOKING_UPDATED: 'booking:updated',
  BOOKING_DELETED: 'booking:deleted',
} as const;

export async function triggerDOEvent(
  event: (typeof PUSHER_EVENTS)[keyof typeof PUSHER_EVENTS],
  data: { id: string }
) {
  try {
    const pusher = getPusher();
    await pusher.trigger(PUSHER_CHANNEL, event, data);
  } catch (error) {
    console.error('Pusher trigger error:', error);
  }
}

export async function triggerBookingEvent(
  event: (typeof PUSHER_EVENTS)[keyof typeof PUSHER_EVENTS],
  data: { id: string }
) {
  try {
    const pusher = getPusher();
    await pusher.trigger(BOOKING_CHANNEL, event, data);
  } catch (error) {
    console.error('Pusher booking trigger error:', error);
  }
}
