import type { CursorPage } from '../cursor-pagination';
import type { Agent, AiConversation, AiMessage, AiToolCall, UserAgentMemory } from '../../domain/ai';

export interface CreateAiConversationRequest {
  agentId: string;
  title?: string;
}

export interface CreateAiMessageRequest {
  content: string;
}

export type AgentListResponse = Agent[];
export type AiConversationListResponse = CursorPage<AiConversation>;
export type CreateAiConversationResponse = AiConversation;
export type AiMessageListResponse = CursorPage<AiMessage>;
export type CreateAiMessageResponse = AiMessage;
export type AiToolCallListResponse = CursorPage<AiToolCall>;
export type ApproveAiToolCallResponse = AiToolCall;
export type RejectAiToolCallResponse = AiToolCall;

/** GET /api/v1/ai/memories */
export type UserAgentMemoryListResponse = UserAgentMemory[];

/** POST /api/v1/ai/memories */
export interface CreateUserAgentMemoryRequest {
  kind: UserAgentMemory['kind'];
  content: string;
}

export type CreateUserAgentMemoryResponse = UserAgentMemory;

/** DELETE /api/v1/ai/memories/:id */
export interface DeleteUserAgentMemoryResponse {
  success: true;
}
