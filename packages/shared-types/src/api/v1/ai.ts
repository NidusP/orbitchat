import type { CursorPage } from '../cursor-pagination';
import type { Agent, AiConversation, AiMessage, AiToolCall } from '../../domain/ai';

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
