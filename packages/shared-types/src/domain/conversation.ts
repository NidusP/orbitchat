import type { ClientPlatform } from './client';
import type { PostMediaItem } from './upload';

export type ConversationType = 'direct' | 'group';

export type GroupMemberRole = 'owner' | 'admin' | 'member';

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
  /** Attached images when present (MVP: at most one per message). */
  media?: PostMediaItem[];
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

/** One revision snapshot before an edit (not a chat message row). */
export interface MessageEditRecord {
  id: string;
  messageId: string;
  editor: ConversationParticipant;
  previousContent: string;
  editedAt: string;
}

/**
 * Recall (withdraw) system event — shown on the timeline but NOT stored in `messages`.
 * Does not affect unread counts or conversation last-message preview.
 */
export interface MessageRecall {
  id: string;
  conversationId: string;
  messageId: string;
  recalledBy: ConversationParticipant;
  messageCreatedAt: string;
  recalledAt: string;
}

export interface GroupMember extends ConversationParticipant {
  role: GroupMemberRole;
  joinedAt: string;
}

export interface GroupInvite {
  id: string;
  conversationId: string;
  code: string;
  createdByUserId: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupInvitePreview {
  code: string;
  conversationId: string;
  groupTitle: string;
  memberCount: number;
  isActive: boolean;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  /** Group avatar media URL; null for direct chats or groups without a custom avatar. */
  avatarUrl: string | null;
  announcement: string | null;
  participants: ConversationParticipant[];
  viewerRole: GroupMemberRole | null;
  lastMessage: Message | null;
  lastMessageAt: string | null;
  unreadCount: number;
  /** Optimistic lock for collaborative metadata edits (e.g. group title). */
  version: number;
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

export interface MessageRecalledPayload {
  conversationId: string;
  recall: MessageRecall;
}

export interface TypingPayload {
  conversationId: string;
  userId: string;
  displayName: string;
}

export interface MemberJoinedPayload {
  conversationId: string;
  member: GroupMember;
}

export interface MemberLeftPayload {
  conversationId: string;
  userId: string;
  reason: 'kicked' | 'left';
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
  'message.recalled': MessageRecalledPayload;
  'typing.started': TypingPayload;
  'typing.stopped': TypingPayload;
  'member.joined': MemberJoinedPayload;
  'member.left': MemberLeftPayload;
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
