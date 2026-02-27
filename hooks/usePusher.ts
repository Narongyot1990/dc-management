'use client';

import { useEffect, useRef } from 'react';
import Pusher from 'pusher-js';
import type { Channel } from 'pusher-js';

let pusherInstance: Pusher | null = null;

function getPusherClient(): Pusher | null {
  if (typeof window === 'undefined') return null;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) return null;

  if (!pusherInstance) {
    pusherInstance = new Pusher(key, { cluster, forceTLS: true });
  }
  return pusherInstance;
}

const DO_CHANNEL = 'delivery-orders';
const BOOKING_CHANNEL = 'shipment-bookings';

const DO_EVENTS = {
  DO_CREATED: 'do:created',
  DO_UPDATED: 'do:updated',
  DO_DELETED: 'do:deleted',
} as const;

const BOOKING_EVENTS = {
  BOOKING_CREATED: 'booking:created',
  BOOKING_UPDATED: 'booking:updated',
  BOOKING_DELETED: 'booking:deleted',
} as const;

function useChannelEvents(channel: string, events: string[], onEvent: () => void) {
  const channelRef = useRef<Channel | null>(null);
  const callbackRef = useRef(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    channelRef.current = pusher.subscribe(channel);
    const handler = () => callbackRef.current();

    for (const evt of events) {
      channelRef.current.bind(evt, handler);
    }

    return () => {
      if (channelRef.current) {
        for (const evt of events) {
          channelRef.current.unbind(evt, handler);
        }
        pusher.unsubscribe(channel);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);
}

export function useDOEvents(onEvent: () => void) {
  useChannelEvents(
    DO_CHANNEL,
    Object.values(DO_EVENTS),
    onEvent
  );
}

export function useBookingEvents(onEvent: () => void) {
  useChannelEvents(
    BOOKING_CHANNEL,
    Object.values(BOOKING_EVENTS),
    onEvent
  );
}
