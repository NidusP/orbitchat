import type {
  AddGroupMembersRequest,
  Conversation,
  ConversationListResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  CreateMessageRequest,
  CreateMessageResponse,
  CursorPageParams,
  GetConversationResponse,
  GroupMember,
  GroupMemberListResponse,
  MarkConversationReadRequest,
  MarkConversationReadResponse,
  MessageListResponse,
  TransferGroupOwnerRequest,
  UpdateGroupConversationRequest,
  UpdateGroupMemberRoleRequest,
} from '@orbitchat/shared-types';
import { apiRequest } from './client';

function buildQuery(params: CursorPageParams): string {
  const search = new URLSearchParams();
  if (params.cursor) {
    search.set('cursor', params.cursor);
  }
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listConversations(
  params: CursorPageParams = {}
): Promise<ConversationListResponse> {
  return apiRequest<ConversationListResponse>(`/api/v1/conversations${buildQuery(params)}`);
}

export async function createConversation(
  input: CreateConversationRequest
): Promise<CreateConversationResponse> {
  return apiRequest<CreateConversationResponse>('/api/v1/conversations', {
    method: 'POST',
    body: input,
  });
}

export async function getConversation(conversationId: string): Promise<GetConversationResponse> {
  return apiRequest<GetConversationResponse>(`/api/v1/conversations/${conversationId}`);
}

export async function listMessages(
  conversationId: string,
  params: CursorPageParams = {}
): Promise<MessageListResponse> {
  return apiRequest<MessageListResponse>(
    `/api/v1/conversations/${conversationId}/messages${buildQuery(params)}`
  );
}

export async function sendMessage(
  conversationId: string,
  input: CreateMessageRequest
): Promise<CreateMessageResponse> {
  return apiRequest<CreateMessageResponse>(`/api/v1/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: input,
  });
}

export async function markConversationRead(
  conversationId: string,
  input: MarkConversationReadRequest = {}
): Promise<MarkConversationReadResponse> {
  return apiRequest<MarkConversationReadResponse>(`/api/v1/conversations/${conversationId}/read`, {
    method: 'PATCH',
    body: input,
  });
}

export async function listGroupMembers(conversationId: string): Promise<GroupMemberListResponse> {
  return apiRequest<GroupMemberListResponse>(`/api/v1/conversations/${conversationId}/members`);
}

export async function addGroupMembers(
  conversationId: string,
  input: AddGroupMembersRequest
): Promise<GroupMemberListResponse> {
  return apiRequest<GroupMemberListResponse>(`/api/v1/conversations/${conversationId}/members`, {
    method: 'POST',
    body: input,
  });
}

export async function removeGroupMember(
  conversationId: string,
  userId: string
): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/api/v1/conversations/${conversationId}/members/${userId}`, {
    method: 'DELETE',
  });
}

export async function updateGroupMemberRole(
  conversationId: string,
  userId: string,
  input: UpdateGroupMemberRoleRequest
): Promise<GroupMemberListResponse> {
  return apiRequest<GroupMemberListResponse>(
    `/api/v1/conversations/${conversationId}/members/${userId}`,
    {
      method: 'PATCH',
      body: input,
    }
  );
}

export async function leaveGroup(conversationId: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>(`/api/v1/conversations/${conversationId}/leave`, {
    method: 'POST',
    body: {},
  });
}

export async function updateGroupTitle(
  conversationId: string,
  input: UpdateGroupConversationRequest
): Promise<GetConversationResponse> {
  return apiRequest<GetConversationResponse>(`/api/v1/conversations/${conversationId}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function transferGroupOwner(
  conversationId: string,
  input: TransferGroupOwnerRequest
): Promise<GroupMemberListResponse> {
  return apiRequest<GroupMemberListResponse>(
    `/api/v1/conversations/${conversationId}/transfer-owner`,
    {
      method: 'POST',
      body: input,
    }
  );
}

export function getOtherParticipant(
  conversation: Conversation,
  currentUserId: string
): Conversation['participants'][number] | null {
  return conversation.participants.find((participant) => participant.id !== currentUserId) ?? null;
}

export function getConversationDisplayName(
  conversation: Conversation,
  currentUserId: string
): string {
  if (conversation.type === 'group' && conversation.title) {
    return conversation.title;
  }

  const other = getOtherParticipant(conversation, currentUserId);
  return other?.displayName ?? 'Conversation';
}

export async function createGroupConversation(
  input: Extract<CreateConversationRequest, { type: 'group' }>
): Promise<CreateConversationResponse> {
  return apiRequest<CreateConversationResponse>('/api/v1/conversations', {
    method: 'POST',
    body: input,
  });
}

export type { GroupMember };
