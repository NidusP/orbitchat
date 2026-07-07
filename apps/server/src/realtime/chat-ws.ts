import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import type { UpgradeWebSocket, WSContext } from 'hono/ws';
import { AppError } from '../lib/errors';
import { listConversationIdsForUser } from '../services/conversation-service';
import { touchSession } from '../services/session-service';
import { chatHub } from './chat-hub';
import { authenticateChatWs } from './ws-auth';
import { handleTypingEvent, isTypingEvent } from '../services/typing-service';

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
    upgradeWebSocket((c) => {
      let activeConnectionId: string | null = null;

      return {
      onOpen(_event, ws) {
        void (async () => {
          try {
            const auth = await authenticateChatWs(c);
            await touchSession(auth.sessionId);

            const connectionId = randomUUID();
            activeConnectionId = connectionId;
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
        void (async () => {
          const connectionId = connectionIdsBySocket.get(ws) ?? activeConnectionId;
          if (!connectionId) {
            return;
          }

          const registered = chatHub.getConnectionMeta(connectionId);
          if (!registered) {
            return;
          }

          try {
            const frame = JSON.parse(String(event.data)) as {
              type?: string;
              payload?: { conversationId?: string };
            };

            if (frame.type === 'pong' || frame.type === 'message.ack') {
              return;
            }

            const frameType = frame.type;
            if (frameType && isTypingEvent(frameType)) {
              const conversationId = frame.payload?.conversationId;
              if (!conversationId) {
                ws.send(
                  JSON.stringify(wsError('VALIDATION_ERROR', 'conversationId is required'))
                );
                return;
              }
              await handleTypingEvent(registered.userId, conversationId, frameType);
              return;
            }
          } catch (error) {
            if (error instanceof AppError) {
              ws.send(JSON.stringify(wsError(error.code, error.message)));
              return;
            }
            ws.send(JSON.stringify(wsError('INVALID_MESSAGE', 'Invalid WebSocket frame')));
          }
        })();
      },
      onClose(_event, ws) {
        const connectionId = connectionIdsBySocket.get(ws) ?? activeConnectionId;
        if (connectionId) {
          chatHub.removeConnection(connectionId);
          connectionIdsBySocket.delete(ws);
          activeConnectionId = null;
        }
      },
    };
    })
  );
}
