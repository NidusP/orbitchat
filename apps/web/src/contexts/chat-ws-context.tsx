'use client';

import type {
  MemberJoinedPayload,
  MemberLeftPayload,
  MessageNewPayload,
  MessageReadPayload,
  TypingPayload,
  WsMessage,
} from '@orbitchat/shared-types';
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

export type ChatRealtimeEvent =
  | WsMessage<'message.new'>
  | WsMessage<'message.read'>
  | WsMessage<'typing.started'>
  | WsMessage<'typing.stopped'>
  | WsMessage<'member.joined'>
  | WsMessage<'member.left'>;

type MessageListener = (event: ChatRealtimeEvent) => void;
type TypingSignal = 'started' | 'stopped';

interface ChatWsContextValue {
  subscribe: (listener: MessageListener) => () => void;
  sendTyping: (conversationId: string, signal: TypingSignal) => void;
  isConnected: boolean;
}

const ChatWsContext = createContext<ChatWsContextValue | null>(null);

export function ChatWsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const listenersRef = useRef(new Set<MessageListener>());
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const subscribe = useCallback((listener: MessageListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const sendTyping = useCallback((conversationId: string, signal: TypingSignal) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const type = signal === 'started' ? 'typing.started' : 'typing.stopped';
    ws.send(
      JSON.stringify({
        type,
        payload: { conversationId },
        timestamp: new Date().toISOString(),
      })
    );
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      setIsConnected(false);
      wsRef.current = null;
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
      if (type === 'error') {
        setIsConnected(false);
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
      if (type === 'typing.started' || type === 'typing.stopped') {
        listenersRef.current.forEach((listener) => {
          listener({
            type,
            payload: payload as TypingPayload,
            timestamp: new Date().toISOString(),
          });
        });
      }
      if (type === 'member.joined') {
        listenersRef.current.forEach((listener) => {
          listener({
            type,
            payload: payload as MemberJoinedPayload,
            timestamp: new Date().toISOString(),
          });
        });
      }
      if (type === 'member.left') {
        listenersRef.current.forEach((listener) => {
          listener({
            type,
            payload: payload as MemberLeftPayload,
            timestamp: new Date().toISOString(),
          });
        });
      }
    });

    wsRef.current = ws;

    ws.addEventListener('close', () => {
      setIsConnected(false);
      wsRef.current = null;
    });

    return () => {
      ws.close();
      wsRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, isLoading]);

  const value = useMemo(
    () => ({
      subscribe,
      sendTyping,
      isConnected,
    }),
    [subscribe, sendTyping, isConnected]
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
