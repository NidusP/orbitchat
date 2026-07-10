import type { CursorPage } from '../cursor-pagination';
import type {
  Conversation,
  GroupInvite,
  GroupInvitePreview,
  GroupMember,
  Message,
  MessageEditRecord,
  MessageRecall,
} from '../../domain/conversation';

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

export interface UpdateMessageRequest {
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
  title?: string;
  announcement?: string | null;
  expectedVersion: number;
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

export type CreateGroupInviteRequest = {
  expiresInHours?: number;
  maxUses?: number;
};

export type GroupMemberListResponse = GroupMember[];
export type GroupInviteListResponse = GroupInvite[];
export type CreateGroupInviteResponse = GroupInvite;
export type GroupInvitePreviewResponse = GroupInvitePreview;
export interface MessageListResponse {
  items: Message[];
  recalls: MessageRecall[];
  nextCursor: string | null;
}
export type MessageEditListResponse = MessageEditRecord[];
export type CreateMessageResponse = Message;
export type UpdateMessageResponse = Message;
