"use client";

import { useState, useEffect, useCallback } from 'react';
import { appConfig } from '@/config/app.config';

interface OfflineState {
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  queuedActions: number;
}

export function useOffline() {
  const [state, setState] = useState<OfflineState>({
    isOnline: true,
    isServiceWorkerReady: false,
    queuedActions: 0
  });

  // Check online status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setState(prev => ({ ...prev, isOnline: navigator.onLine }));
    };

    // Set initial state
    updateOnlineStatus();

    // Listen for changes
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Register or Unregister service worker based on config
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // If offline mode is DISABLED, unregister SW and clear caches
    if (!appConfig.enableOfflineMode) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
          console.log('[SW] Unregistered:', registration.scope);
        });
      });

      // Clear all caches
      caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          caches.delete(cacheName);
          console.log('[SW] Deleted cache:', cacheName);
        });
      });

      setState(prev => ({ ...prev, isServiceWorkerReady: false }));
      return;
    }

    // Offline mode is ENABLED - register SW
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[SW] Registered:', registration.scope);
        setState(prev => ({ ...prev, isServiceWorkerReady: true }));

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] New version available');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[SW] Registration failed:', error);
      });

    // Listen for messages from SW
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SYNC_COMPLETE') {
        console.log('[SW] Sync complete:', event.data.url);
        getQueueCount();
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  // Get queued actions count
  const getQueueCount = useCallback(async () => {
    if (!appConfig.enableOfflineMode) return;

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        setState(prev => ({ ...prev, queuedActions: event.data.count }));
      };
      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_QUEUE_COUNT' },
        [messageChannel.port2]
      );
    }
  }, []);

  // Check queue count periodically
  useEffect(() => {
    if (!appConfig.enableOfflineMode) return;

    getQueueCount();
    const interval = setInterval(getQueueCount, 10000);
    return () => clearInterval(interval);
  }, [getQueueCount]);

  // Request background sync
  const requestSync = useCallback(async () => {
    if (!appConfig.enableOfflineMode) return;

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const registration = await navigator.serviceWorker.ready;
      try {
        await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-offline-queue');
        console.log('[SW] Background sync registered');
      } catch (error) {
        console.log('[SW] Background sync not supported:', error);
      }
    }
  }, []);

  // Trigger sync when coming back online
  useEffect(() => {
    if (!appConfig.enableOfflineMode) return;

    if (state.isOnline && state.queuedActions > 0) {
      requestSync();
    }
  }, [state.isOnline, state.queuedActions, requestSync]);

  return {
    ...state,
    requestSync,
    refreshQueueCount: getQueueCount,
    offlineModeEnabled: appConfig.enableOfflineMode
  };
}
