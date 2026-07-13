'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getNotificationUnreadCount } from '@/lib/api/notifications';
import { useAuth } from './auth-context';

interface InteractionNotificationsContextValue {
  totalUnread: number;
  refresh: () => Promise<void>;
}

const InteractionNotificationsContext =
  createContext<InteractionNotificationsContextValue | null>(null);

export function InteractionNotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const refreshRequestRef = useRef(0);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      refreshRequestRef.current += 1;
      setTotalUnread(0);
      return;
    }

    const requestId = refreshRequestRef.current + 1;
    refreshRequestRef.current = requestId;

    try {
      const result = await getNotificationUnreadCount();
      if (requestId !== refreshRequestRef.current || !isAuthenticatedRef.current) {
        return;
      }
      setTotalUnread(Math.max(0, result.count));
    } catch {
      // Keep current unread count on transient failures.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      setTotalUnread(0);
      return;
    }

    void refresh();
  }, [authLoading, isAuthenticated, refresh]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isAuthenticated, refresh]);

  const value = useMemo<InteractionNotificationsContextValue>(
    () => ({
      totalUnread,
      refresh,
    }),
    [refresh, totalUnread]
  );

  return (
    <InteractionNotificationsContext.Provider value={value}>
      {children}
    </InteractionNotificationsContext.Provider>
  );
}

export function useInteractionNotifications(): InteractionNotificationsContextValue {
  const context = useContext(InteractionNotificationsContext);
  if (!context) {
    throw new Error(
      'useInteractionNotifications must be used within InteractionNotificationsProvider'
    );
  }
  return context;
}
