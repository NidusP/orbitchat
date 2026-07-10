import type {
  ConnectionMeta,
  MemberJoinedPayload,
  MemberLeftPayload,
  MessageNewPayload,
  MessageReadPayload,
  MessageRecalledPayload,
  TypingPayload,
  WsMessage,
} from '@orbitchat/shared-types';
import type { WSContext } from 'hono/ws';
import { conversationRoomId } from '../lib/direct-key';

type ChatSocket = WSContext | { send: (data: string) => void };

interface RegisteredConnection {
  socket: ChatSocket;
  meta: ConnectionMeta;
}

function sendJson(socket: ChatSocket, message: WsMessage): void {
  socket.send(JSON.stringify(message));
}

class ChatHub {
  private connectionsById = new Map<string, RegisteredConnection>();
  private connectionsByUserId = new Map<string, Set<string>>();
  private connectionsBySession = new Map<string, Set<string>>();
  private connectionsByRoomId = new Map<string, Set<string>>();

  addConnection(meta: ConnectionMeta, socket: ChatSocket): void {
    this.connectionsById.set(meta.connectionId, { socket, meta });

    const userSet = this.connectionsByUserId.get(meta.userId) ?? new Set<string>();
    userSet.add(meta.connectionId);
    this.connectionsByUserId.set(meta.userId, userSet);

    const sessionSet = this.connectionsBySession.get(meta.sessionId) ?? new Set<string>();
    sessionSet.add(meta.connectionId);
    this.connectionsBySession.set(meta.sessionId, sessionSet);

    for (const roomId of meta.joinedRooms) {
      this.joinRoom(meta.connectionId, roomId);
    }
  }

  removeConnection(connectionId: string): void {
    const registered = this.connectionsById.get(connectionId);
    if (!registered) {
      return;
    }

    const { meta } = registered;
    this.connectionsById.delete(connectionId);

    const userSet = this.connectionsByUserId.get(meta.userId);
    userSet?.delete(connectionId);
    if (userSet && userSet.size === 0) {
      this.connectionsByUserId.delete(meta.userId);
    }

    const sessionSet = this.connectionsBySession.get(meta.sessionId);
    sessionSet?.delete(connectionId);
    if (sessionSet && sessionSet.size === 0) {
      this.connectionsBySession.delete(meta.sessionId);
    }

    for (const roomId of meta.joinedRooms) {
      const roomSet = this.connectionsByRoomId.get(roomId);
      roomSet?.delete(connectionId);
      if (roomSet && roomSet.size === 0) {
        this.connectionsByRoomId.delete(roomId);
      }
    }
  }

  joinRoom(connectionId: string, roomId: string): void {
    const registered = this.connectionsById.get(connectionId);
    if (!registered) {
      return;
    }

    if (!registered.meta.joinedRooms.includes(roomId)) {
      registered.meta.joinedRooms.push(roomId);
    }
    const roomSet = this.connectionsByRoomId.get(roomId) ?? new Set<string>();
    roomSet.add(connectionId);
    this.connectionsByRoomId.set(roomId, roomSet);
  }

  joinConversationRooms(connectionId: string, conversationIds: string[]): void {
    for (const conversationId of conversationIds) {
      this.joinRoom(connectionId, conversationRoomId(conversationId));
    }
  }

  broadcast(roomId: string, message: WsMessage): void {
    const connectionIds = this.connectionsByRoomId.get(roomId);
    if (!connectionIds) {
      return;
    }

    for (const connectionId of connectionIds) {
      const registered = this.connectionsById.get(connectionId);
      if (registered) {
        sendJson(registered.socket, message);
      }
    }
  }

  broadcastExcept(roomId: string, message: WsMessage, excludeUserId: string): void {
    const connectionIds = this.connectionsByRoomId.get(roomId);
    if (!connectionIds) {
      return;
    }

    for (const connectionId of connectionIds) {
      const registered = this.connectionsById.get(connectionId);
      if (registered && registered.meta.userId !== excludeUserId) {
        sendJson(registered.socket, message);
      }
    }
  }

  sendToConnection(connectionId: string, message: WsMessage): void {
    const registered = this.connectionsById.get(connectionId);
    if (registered) {
      sendJson(registered.socket, message);
    }
  }

  getConnectionMeta(connectionId: string): ConnectionMeta | null {
    return this.connectionsById.get(connectionId)?.meta ?? null;
  }

  closeSession(sessionId: string, message: WsMessage): void {
    const connectionIds = this.connectionsBySession.get(sessionId);
    if (!connectionIds) {
      return;
    }

    for (const connectionId of [...connectionIds]) {
      const registered = this.connectionsById.get(connectionId);
      if (registered) {
        sendJson(registered.socket, message);
        if ('close' in registered.socket && typeof registered.socket.close === 'function') {
          registered.socket.close();
        }
      }
      this.removeConnection(connectionId);
    }
  }
}

export const chatHub = new ChatHub();

export function broadcastMessageNew(payload: MessageNewPayload): void {
  const message: WsMessage<'message.new'> = {
    type: 'message.new',
    payload,
    timestamp: new Date().toISOString(),
  };

  chatHub.broadcast(conversationRoomId(payload.conversationId), message);
}

export function broadcastMessageRead(payload: MessageReadPayload): void {
  const message: WsMessage<'message.read'> = {
    type: 'message.read',
    payload,
    timestamp: new Date().toISOString(),
  };

  chatHub.broadcast(conversationRoomId(payload.conversationId), message);
}

export function broadcastMessageRecalled(payload: MessageRecalledPayload): void {
  const message: WsMessage<'message.recalled'> = {
    type: 'message.recalled',
    payload,
    timestamp: new Date().toISOString(),
  };

  chatHub.broadcast(conversationRoomId(payload.conversationId), message);
}

export function broadcastTyping(
  type: 'typing.started' | 'typing.stopped',
  payload: TypingPayload
): void {
  const message: WsMessage<'typing.started' | 'typing.stopped'> = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };

  chatHub.broadcastExcept(conversationRoomId(payload.conversationId), message, payload.userId);
}

export function broadcastMemberJoined(payload: MemberJoinedPayload): void {
  const message: WsMessage<'member.joined'> = {
    type: 'member.joined',
    payload,
    timestamp: new Date().toISOString(),
  };

  chatHub.broadcast(conversationRoomId(payload.conversationId), message);
}

export function broadcastMemberLeft(payload: MemberLeftPayload): void {
  const message: WsMessage<'member.left'> = {
    type: 'member.left',
    payload,
    timestamp: new Date().toISOString(),
  };

  chatHub.broadcast(conversationRoomId(payload.conversationId), message);
}
