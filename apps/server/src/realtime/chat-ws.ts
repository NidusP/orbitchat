import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import type { UpgradeWebSocket, WSContext } from 'hono/ws';
import { AppError } from '../lib/errors';
import { listConversationIdsForUser } from '../services/conversation-service';
import { touchSession } from '../services/session-service';
import { chatHub } from './chat-hub';
import { authenticateChatWs } from './ws-auth';

function wsError(code: string, message: string) {
  return {
    type: 'error' as const,
    payload: { code, message },
    timestamp: new Date().toISOString(),
  };
}

const connectionIdsBySocket = new WeakMap<WSContext, string>();

export function registerChatWs(app: Hono, upgradeWebSocket: UpgradeWebSocket): void {
  app.get(
    '/ws/v1/chat',
    upgradeWebSocket((c) => ({
      onOpen(_event, ws) {
        void (async () => {
          try {
            const auth = await authenticateChatWs(c);
            await touchSession(auth.sessionId);

            const connectionId = randomUUID();
            const conversationIds = await listConversationIdsForUser(auth.userId);
            const connectedAt = new Date().toISOString();

            connectionIdsBySocket.set(ws, connectionId);

            chatHub.addConnection(
              {
                connectionId,
                userId: auth.userId,
                sessionId: auth.sessionId,
                deviceId: auth.deviceId,
                platform: auth.platform,
                joinedRooms: [],
                lastSeenAt: connectedAt,
              },
              ws
            );

            chatHub.joinConversationRooms(connectionId, conversationIds);

            chatHub.sendToConnection(connectionId, {
              type: 'connection.ready',
              payload: {
                connectionId,
                userId: auth.userId,
                sessionId: auth.sessionId,
                connectedAt,
              },
              timestamp: connectedAt,
            });
          } catch (error) {
            const appError =
              error instanceof AppError
                ? error
                : new AppError('UNAUTHORIZED', 'WebSocket authentication failed', 401);

            ws.send(JSON.stringify(wsError(appError.code, appError.message)));
            ws.close();
          }
        })();
      },
      onMessage(event, ws) {
        try {
          const frame = JSON.parse(String(event.data)) as { type?: string };
          if (frame.type === 'pong' || frame.type === 'message.ack') {
            return;
          }
        } catch {
          ws.send(JSON.stringify(wsError('INVALID_MESSAGE', 'Invalid WebSocket frame')));
        }
      },
      onClose(_event, ws) {
        const connectionId = connectionIdsBySocket.get(ws);
        if (connectionId) {
          chatHub.removeConnection(connectionId);
          connectionIdsBySocket.delete(ws);
        }
      },
    }))
  );
}
