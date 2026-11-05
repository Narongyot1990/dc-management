"use client";

import { useOffline } from '@/hooks/useOffline';
import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useEffect } from 'react';

export function ConnectionStatus() {
  const { isOnline, queuedActions } = useOffline();
  const { t } = useLanguage();
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Show banner when status changes
  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
      setWasOffline(true);
    } else if (wasOffline) {
      // Show "back online" briefly
      setShowBanner(true);
      const timer = setTimeout(() => {
        setShowBanner(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Always show if offline or has queued actions
  const shouldShow = !isOnline || queuedActions > 0 || showBanner;

  if (!shouldShow) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        showBanner ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      {!isOnline ? (
        // Offline banner
        <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-200"></span>
          </span>
          <span className="font-medium">
            📡 {t('offline_mode') || 'Offline Mode'} - {t('offline_message') || 'Changes will sync when connected'}
          </span>
          {queuedActions > 0 && (
            <span className="bg-orange-600 px-2 py-0.5 rounded-full text-xs">
              {queuedActions} {t('queued') || 'queued'}
            </span>
          )}
        </div>
      ) : wasOffline ? (
        // Back online banner
        <div className="bg-green-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm">
          <span className="text-lg">✓</span>
          <span className="font-medium">
            {t('back_online') || 'Back Online'} - {t('syncing') || 'Syncing data...'}
          </span>
        </div>
      ) : queuedActions > 0 ? (
        // Syncing banner
        <div className="bg-blue-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm">
          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
          <span className="font-medium">
            {t('syncing') || 'Syncing'} {queuedActions} {t('pending_changes') || 'pending changes'}...
          </span>
        </div>
      ) : null}
    </div>
  );
}

// Mini indicator for header
export function ConnectionIndicator() {
  const { isOnline, queuedActions } = useOffline();

  return (
    <div className="flex items-center gap-1">
      <span
        className={`w-2 h-2 rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-orange-500 animate-pulse'
        }`}
        title={isOnline ? 'Online' : 'Offline'}
      />
      {queuedActions > 0 && (
        <span className="text-[10px] text-orange-600 font-medium">
          {queuedActions}
        </span>
      )}
    </div>
  );
}
