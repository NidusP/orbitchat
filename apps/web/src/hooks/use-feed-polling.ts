'use client';

import { useEffect } from 'react';

const FEED_POLL_MS = 60_000;

/**
 * ADR 12: poll home feed while tab is visible; stop when hidden or unmounted.
 */
export function useFeedPolling(onPoll: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function tick(): void {
      if (document.visibilityState === 'visible') {
        onPoll();
      }
    }

    const intervalId = window.setInterval(tick, FEED_POLL_MS);

    function handleVisibility(): void {
      if (document.visibilityState === 'visible') {
        onPoll();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, onPoll]);
}
