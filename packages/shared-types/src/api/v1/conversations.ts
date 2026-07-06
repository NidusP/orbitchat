import type { CursorPage } from '../cursor-pagination';
import type { Conversation, Message } from '../../domain/conversation';

export interface CreateConversationRequest {
  participantUserId: string;
}

export interface CreateMessageRequest {
  content: string;
}

export interface MarkConversationReadRequest {
  readAt?: string;
}

export interface MarkConversationReadResponse {
  conversationId: string;
  lastReadAt: string;
}

export type ConversationListResponse = CursorPage<Conversation>;
export type CreateConversationResponse = Conversation;
export type GetConversationResponse = Conversation;
export type MessageListResponse = CursorPage<Message>;
export type CreateMessageResponse = Message;
