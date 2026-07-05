'use client';

import type { MessageNewPayload, MessageReadPayload, WsMessage } from '@orbitchat/shared-types';
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
import { getAccessToken } from '@/lib/api/client';
import { createChatSocket } from '@/lib/ws/chat-socket';
import { useAuth } from './auth-context';

type ChatRealtimeEvent = WsMessage<'message.new'> | WsMessage<'message.read'>;
type MessageListener = (event: ChatRealtimeEvent) => void;

interface ChatWsContextValue {
  subscribe: (listener: MessageListener) => () => void;
  isConnected: boolean;
}

const ChatWsContext = createContext<ChatWsContextValue | null>(null);

export function ChatWsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const listenersRef = useRef(new Set<MessageListener>());
  const [isConnected, setIsConnected] = useState(false);

  const subscribe = useCallback((listener: MessageListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      setIsConnected(false);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      return;
    }

    const ws = createChatSocket(token, (type, payload) => {
      if (type === 'connection.ready') {
        setIsConnected(true);
      }
      if (type === 'message.new') {
        listenersRef.current.forEach((listener) => {
          listener({
            type,
            payload: payload as MessageNewPayload,
            timestamp: new Date().toISOString(),
          });
        });
      }
      if (type === 'message.read') {
        listenersRef.current.forEach((listener) => {
          listener({
            type,
            payload: payload as MessageReadPayload,
            timestamp: new Date().toISOString(),
          });
        });
      }
    });

    ws.addEventListener('open', () => {
      setIsConnected(true);
    });

    ws.addEventListener('close', () => {
      setIsConnected(false);
    });

    return () => {
      ws.close();
      setIsConnected(false);
    };
  }, [isAuthenticated, isLoading]);

  const value = useMemo(
    () => ({
      subscribe,
      isConnected,
    }),
    [subscribe, isConnected]
  );

  return <ChatWsContext.Provider value={value}>{children}</ChatWsContext.Provider>;
}

export function useChatWs(): ChatWsContextValue {
  const context = useContext(ChatWsContext);
  if (!context) {
    throw new Error('useChatWs must be used within ChatWsProvider');
  }
  return context;
}
