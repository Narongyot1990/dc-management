"use client";

import { useEffect, useRef, useCallback } from 'react';
import Pusher from 'pusher-js';
import type { Channel } from 'pusher-js';

// Pusher channels and events (must match server-side)
export const PUSHER_CHANNELS = {
  JOBS: 'jobs',
  BOOKINGS: 'bookings',
  DOCKS: 'docks',
} as const;

export const PUSHER_EVENTS = {
  JOB_CREATED: 'job:created',
  JOB_UPDATED: 'job:updated',
  JOB_COMPLETED: 'job:completed',
  JOB_ISSUE: 'job:issue',
  BOOKING_CREATED: 'booking:created',
  BOOKING_UPDATED: 'booking:updated',
  BOOKING_LINKED: 'booking:linked',
  DOCK_UPDATED: 'dock:updated',
} as const;

// Singleton Pusher instance
let pusherInstance: Pusher | null = null;

function getPusherClient(): Pusher | null {
  if (typeof window === 'undefined') return null;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    console.warn('Pusher client credentials not configured');
    return null;
  }

  if (!pusherInstance) {
    pusherInstance = new Pusher(key, {
      cluster,
      forceTLS: true,
    });
  }

  return pusherInstance;
}

// =============================================
// Generic Pusher Hook
// =============================================

interface UsePusherOptions<T> {
  channel: string;
  event: string;
  onEvent: (data: T) => void;
  enabled?: boolean;
}

export function usePusher<T>({
  channel,
  event,
  onEvent,
  enabled = true,
}: UsePusherOptions<T>) {
  const channelRef = useRef<Channel | null>(null);
  const onEventRef = useRef(onEvent);

  // Update callback ref
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    // Subscribe to channel
    channelRef.current = pusher.subscribe(channel);

    // Bind to event
    channelRef.current.bind(event, (data: T) => {
      onEventRef.current(data);
    });

    console.log(`Pusher: subscribed to ${channel}:${event}`);

    return () => {
      if (channelRef.current) {
        channelRef.current.unbind(event);
        pusher.unsubscribe(channel);
        console.log(`Pusher: unsubscribed from ${channel}:${event}`);
      }
    };
  }, [channel, event, enabled]);
}

// =============================================
// Specialized Hooks
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
 * Hook for job events
 */
export function useJobEvents(callbacks: {
  onJobCreated?: (data: JobEventData) => void;
  onJobUpdated?: (data: JobEventData) => void;
  onJobCompleted?: (data: JobEventData) => void;
  onJobIssue?: (data: JobEventData) => void;
}) {
  usePusher({
    channel: PUSHER_CHANNELS.JOBS,
    event: PUSHER_EVENTS.JOB_CREATED,
    onEvent: callbacks.onJobCreated || (() => {}),
    enabled: !!callbacks.onJobCreated,
  });

  usePusher({
    channel: PUSHER_CHANNELS.JOBS,
    event: PUSHER_EVENTS.JOB_UPDATED,
    onEvent: callbacks.onJobUpdated || (() => {}),
    enabled: !!callbacks.onJobUpdated,
  });

  usePusher({
    channel: PUSHER_CHANNELS.JOBS,
    event: PUSHER_EVENTS.JOB_COMPLETED,
    onEvent: callbacks.onJobCompleted || (() => {}),
    enabled: !!callbacks.onJobCompleted,
  });

  usePusher({
    channel: PUSHER_CHANNELS.JOBS,
    event: PUSHER_EVENTS.JOB_ISSUE,
    onEvent: callbacks.onJobIssue || (() => {}),
    enabled: !!callbacks.onJobIssue,
  });
}

/**
 * Hook for booking events
 */
export function useBookingEvents(callbacks: {
  onBookingCreated?: (data: BookingEventData) => void;
  onBookingUpdated?: (data: BookingEventData) => void;
  onBookingLinked?: (data: BookingEventData) => void;
}) {
  usePusher({
    channel: PUSHER_CHANNELS.BOOKINGS,
    event: PUSHER_EVENTS.BOOKING_CREATED,
    onEvent: callbacks.onBookingCreated || (() => {}),
    enabled: !!callbacks.onBookingCreated,
  });

  usePusher({
    channel: PUSHER_CHANNELS.BOOKINGS,
    event: PUSHER_EVENTS.BOOKING_UPDATED,
    onEvent: callbacks.onBookingUpdated || (() => {}),
    enabled: !!callbacks.onBookingUpdated,
  });

  usePusher({
    channel: PUSHER_CHANNELS.BOOKINGS,
    event: PUSHER_EVENTS.BOOKING_LINKED,
    onEvent: callbacks.onBookingLinked || (() => {}),
    enabled: !!callbacks.onBookingLinked,
  });
}

/**
 * Hook for dock events
 */
export function useDockEvents(onDockUpdated: (data: DockEventData) => void) {
  usePusher({
    channel: PUSHER_CHANNELS.DOCKS,
    event: PUSHER_EVENTS.DOCK_UPDATED,
    onEvent: onDockUpdated,
  });
}
