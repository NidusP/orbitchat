import type {
  Conversation,
  ConversationListResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  CreateMessageRequest,
  CreateMessageResponse,
  CursorPageParams,
  GetConversationResponse,
  MarkConversationReadRequest,
  MarkConversationReadResponse,
  MessageListResponse,
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

export function getOtherParticipant(
  conversation: Conversation,
  currentUserId: string
): Conversation['participants'][number] | null {
  return conversation.participants.find((participant) => participant.id !== currentUserId) ?? null;
}
