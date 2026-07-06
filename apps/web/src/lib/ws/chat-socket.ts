import type { ChatWsType, MessageNewPayload, WsMessage } from '@orbitchat/shared-types';
import { API_BASE } from '@/lib/api/client';
import { getDeviceId } from '@/lib/api/device-id';

export function getWsBase(): string {
  return API_BASE.replace(/^http/, 'ws');
}

export function buildChatWsUrl(token: string): string {
  const params = new URLSearchParams({
    token,
    deviceId: getDeviceId(),
    platform: 'web',
  });
  return `${getWsBase()}/ws/v1/chat?${params.toString()}`;
}

export type ChatWsListener = (type: ChatWsType, payload: WsMessage['payload']) => void;

export function createChatSocket(
  token: string,
  onEvent: ChatWsListener
): WebSocket {
  const ws = new WebSocket(buildChatWsUrl(token));

  ws.addEventListener('message', (event) => {
    try {
      const frame = JSON.parse(String(event.data)) as WsMessage;

      if (frame.type === 'ping') {
        ws.send(
          JSON.stringify({
            type: 'pong',
            payload: {},
            timestamp: new Date().toISOString(),
          } satisfies WsMessage<'pong'>)
        );
        return;
      }

      onEvent(frame.type, frame.payload);
    } catch {
      // Ignore malformed frames on the client.
    }
  });

  return ws;
}

export type { MessageNewPayload };
