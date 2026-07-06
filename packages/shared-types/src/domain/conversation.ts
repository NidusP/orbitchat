import type { ClientPlatform } from './client';

export type ConversationType = 'direct';

export interface ConversationParticipant {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: ConversationParticipant;
  content: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  participants: ConversationParticipant[];
  lastMessage: Message | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionReadyPayload {
  connectionId: string;
  userId: string;
  sessionId: string;
  connectedAt: string;
}

export interface MessageNewPayload {
  conversationId: string;
  message: Message;
}

export interface MessageAckPayload {
  conversationId: string;
  messageId: string;
  receivedAt: string;
}

export interface MessageReadPayload {
  conversationId: string;
  userId: string;
  lastReadAt: string;
}

export interface WsErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export type ChatWsPayloadByType = {
  'connection.ready': ConnectionReadyPayload;
  ping: Record<string, never>;
  pong: Record<string, never>;
  'message.new': MessageNewPayload;
  'message.ack': MessageAckPayload;
  'message.read': MessageReadPayload;
  error: WsErrorPayload;
};

export type ChatWsType = keyof ChatWsPayloadByType;

export interface WsMessage<TType extends ChatWsType = ChatWsType> {
  type: TType;
  payload: ChatWsPayloadByType[TType];
  timestamp: string;
  requestId?: string;
}

export interface ConnectionMeta {
  connectionId: string;
  userId: string;
  sessionId: string;
  deviceId: string;
  platform: ClientPlatform;
  joinedRooms: string[];
  lastSeenAt: string;
}
