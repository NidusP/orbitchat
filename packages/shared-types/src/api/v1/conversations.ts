import type { CursorPage } from '../cursor-pagination';
import type { Conversation, GroupMember, Message } from '../../domain/conversation';

export interface CreateDirectConversationRequest {
  participantUserId: string;
}

export interface CreateGroupConversationRequest {
  type: 'group';
  title: string;
  memberUserIds: string[];
}

export type CreateConversationRequest =
  | CreateDirectConversationRequest
  | CreateGroupConversationRequest;

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
export type UpdateGroupConversationRequest = {
  title: string;
};

export type AddGroupMembersRequest = {
  userIds: string[];
};

export type TransferGroupOwnerRequest = {
  newOwnerUserId: string;
};

export type UpdateGroupMemberRoleRequest = {
  role: 'admin' | 'member';
};

export type GroupMemberListResponse = GroupMember[];
export type MessageListResponse = CursorPage<Message>;
export type CreateMessageResponse = Message;
