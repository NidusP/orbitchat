import type {
  AgentListResponse,
  AiConversation,
  AiConversationListResponse,
  AiMessage,
  AiMessageListResponse,
  AiSseEvent,
  AiToolCall,
  AiToolCallListResponse,
  ApproveAiToolCallResponse,
  CreateAiConversationRequest,
  CreateAiConversationResponse,
  CreateAiMessageRequest,
  CreateUserAgentMemoryRequest,
  CreateUserAgentMemoryResponse,
  CursorPageParams,
  DeleteUserAgentMemoryResponse,
  RejectAiToolCallResponse,
  UserAgentMemory,
  UserAgentMemoryKind,
  UserAgentMemoryListResponse,
} from '@orbitchat/shared-types';
import { getDeviceId } from './device-id';
import { ApiError, parseApiError } from './errors';
import { API_BASE, apiRequest, getAccessToken } from './client';
import type { ApiResponse } from '@orbitchat/shared-types';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

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

function buildHeaders(): HeadersInit {
  const token = getAccessToken();
  return {
    Accept: 'text/event-stream',
    'Content-Type': 'application/json',
    'X-Client-Platform': 'web',
    'X-Client-Version': APP_VERSION,
    'X-Device-Id': getDeviceId(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function parseSseEvents(buffer: string): { events: AiSseEvent[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: AiSseEvent[] = [];

  for (const part of parts) {
    const dataLine = part
      .split('\n')
      .find((line) => line.startsWith('data: '));
    if (!dataLine) {
      continue;
    }

    try {
      events.push(JSON.parse(dataLine.slice('data: '.length)) as AiSseEvent);
    } catch {
      // Ignore malformed SSE chunks.
    }
  }

  return { events, rest };
}

export async function listAgents(): Promise<AgentListResponse> {
  return apiRequest<AgentListResponse>('/api/v1/ai/agents');
}

export async function listAiConversations(
  params: CursorPageParams = {}
): Promise<AiConversationListResponse> {
  return apiRequest<AiConversationListResponse>(`/api/v1/ai/conversations${buildQuery(params)}`);
}

export async function createAiConversation(
  input: CreateAiConversationRequest
): Promise<CreateAiConversationResponse> {
  return apiRequest<CreateAiConversationResponse>('/api/v1/ai/conversations', {
    method: 'POST',
    body: input,
  });
}

export async function listAiMessages(
  conversationId: string,
  params: CursorPageParams = {}
): Promise<AiMessageListResponse> {
  return apiRequest<AiMessageListResponse>(
    `/api/v1/ai/conversations/${conversationId}/messages${buildQuery(params)}`
  );
}

export async function listAiToolCalls(
  conversationId: string,
  params: CursorPageParams = {}
): Promise<AiToolCallListResponse> {
  return apiRequest<AiToolCallListResponse>(
    `/api/v1/ai/conversations/${conversationId}/tool-calls${buildQuery(params)}`
  );
}

export async function approveAiToolCall(toolCallId: string): Promise<ApproveAiToolCallResponse> {
  return apiRequest<ApproveAiToolCallResponse>(`/api/v1/ai/tool-calls/${toolCallId}/approve`, {
    method: 'POST',
  });
}

export async function rejectAiToolCall(toolCallId: string): Promise<RejectAiToolCallResponse> {
  return apiRequest<RejectAiToolCallResponse>(`/api/v1/ai/tool-calls/${toolCallId}/reject`, {
    method: 'POST',
  });
}

export async function sendAiMessageStream(
  conversationId: string,
  input: CreateAiMessageRequest,
  onEvent: (event: AiSseEvent) => void,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/ai/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
    body: JSON.stringify(input),
    signal: options?.signal,
  });

  if (!response.ok) {
    const body = (await response.json()) as ApiResponse<unknown>;
    throw parseApiError(body, response.status);
  }

  if (!response.body) {
    throw new ApiError('AI_STREAM_FAILED', 'Failed to start AI stream', response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseEvents(buffer);
    buffer = parsed.rest;
    parsed.events.forEach(onEvent);
  }

  buffer += decoder.decode();
  const parsed = parseSseEvents(`${buffer}\n\n`);
  parsed.events.forEach(onEvent);
}

export function sortAiMessages(messages: AiMessage[]): AiMessage[] {
  return [...messages].sort(
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
  );
}

export async function listAiMemories(
  params: { limit?: number } = {}
): Promise<UserAgentMemoryListResponse> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  return apiRequest<UserAgentMemoryListResponse>(
    `/api/v1/ai/memories${query ? `?${query}` : ''}`
  );
}

export async function createAiMemory(
  input: CreateUserAgentMemoryRequest
): Promise<CreateUserAgentMemoryResponse> {
  return apiRequest<CreateUserAgentMemoryResponse>('/api/v1/ai/memories', {
    method: 'POST',
    body: input,
  });
}

export async function deleteAiMemory(id: string): Promise<DeleteUserAgentMemoryResponse> {
  return apiRequest<DeleteUserAgentMemoryResponse>(`/api/v1/ai/memories/${id}`, {
    method: 'DELETE',
  });
}

export type { AiConversation, AiMessage, AiToolCall, UserAgentMemory, UserAgentMemoryKind };
