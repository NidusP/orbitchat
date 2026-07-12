'use client';

import type { Conversation } from '@orbitchat/shared-types';
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
import { listConversations } from '@/lib/api/conversations';
import { useAuth } from './auth-context';
import { useChatWs } from './chat-ws-context';

interface UnreadMessagesContextValue {
  totalUnread: number;
  refresh: () => Promise<void>;
}

const UnreadMessagesContext = createContext<UnreadMessagesContextValue | null>(null);

function buildUnreadIndex(items: Conversation[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, conversation) => {
    acc[conversation.id] = Math.max(0, conversation.unreadCount);
    return acc;
  }, {});
}

function sumUnread(unreadByConversation: Record<string, number>): number {
  return Object.values(unreadByConversation).reduce((total, count) => total + count, 0);
}

export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { subscribe } = useChatWs();
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const isAuthenticatedRef = useRef(isAuthenticated);
  const refreshRequestRef = useRef(0);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      refreshRequestRef.current += 1;
      setUnreadByConversation({});
      return;
    }

    const requestId = refreshRequestRef.current + 1;
    refreshRequestRef.current = requestId;

    try {
      const page = await listConversations({ limit: 50 });
      if (requestId !== refreshRequestRef.current || !isAuthenticatedRef.current) {
        return;
      }
      setUnreadByConversation(buildUnreadIndex(page.items));
    } catch {
      // Keep current unread counters on transient failures.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      setUnreadByConversation({});
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

  useEffect(() => {
    if (!user || !isAuthenticated) {
      return;
    }

    return subscribe((event) => {
      if (event.type === 'message.new') {
        const { payload } = event;
        if (payload.message.sender.id === user.id) {
          return;
        }

        setUnreadByConversation((current) => ({
          ...current,
          [payload.conversationId]: (current[payload.conversationId] ?? 0) + 1,
        }));
      }

      if (event.type === 'message.read' && event.payload.userId === user.id) {
        setUnreadByConversation((current) => {
          if ((current[event.payload.conversationId] ?? 0) === 0) {
            return current;
          }
          return {
            ...current,
            [event.payload.conversationId]: 0,
          };
        });
      }
    });
  }, [isAuthenticated, subscribe, user]);

  const value = useMemo<UnreadMessagesContextValue>(
    () => ({
      totalUnread: sumUnread(unreadByConversation),
      refresh,
    }),
    [refresh, unreadByConversation]
  );

  return <UnreadMessagesContext.Provider value={value}>{children}</UnreadMessagesContext.Provider>;
}

export function useUnreadMessages(): UnreadMessagesContextValue {
  const context = useContext(UnreadMessagesContext);
  if (!context) {
    throw new Error('useUnreadMessages must be used within UnreadMessagesProvider');
  }
  return context;
}
