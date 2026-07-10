export type AiMessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type AiToolCallStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
export type UserAgentMemoryKind = 'preference' | 'fact' | 'nickname';
export type UserAgentMemorySource = 'user_explicit' | 'tool' | 'admin';

export interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  systemPrompt: string;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversation {
  id: string;
  userId: string;
  agentId: string;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  toolName: string | null;
  createdAt: string;
}

export interface AiToolCall {
  id: string;
  conversationId: string;
  requestedByUserId: string;
  toolName: string;
  status: AiToolCallStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  executedAt: string | null;
}

export interface UserAgentMemory {
  id: string;
  userId: string;
  agentId: string | null;
  kind: UserAgentMemoryKind;
  content: string;
  source: UserAgentMemorySource;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type AiSseEventType =
  | 'run.started'
  | 'tool.started'
  | 'message.delta'
  | 'message.done'
  | 'tool.call'
  | 'error';

export interface AiRunStartedPayload {
  conversationId: string;
}

export interface AiToolStartedPayload {
  conversationId: string;
  toolName: string;
  input: unknown;
}

export interface AiMessageDeltaPayload {
  conversationId: string;
  messageId: string;
  delta: string;
}

export interface AiMessageDonePayload {
  conversationId: string;
  message: AiMessage;
}

export interface AiToolCallPayload {
  conversationId: string;
  toolName: string;
  input: unknown;
  output: unknown;
}

export interface AiSseErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export type AiSsePayloadByType = {
  'run.started': AiRunStartedPayload;
  'tool.started': AiToolStartedPayload;
  'message.delta': AiMessageDeltaPayload;
  'message.done': AiMessageDonePayload;
  'tool.call': AiToolCallPayload;
  error: AiSseErrorPayload;
};

export type AiSseEvent<TType extends AiSseEventType = AiSseEventType> = {
  [K in TType]: {
    type: K;
    payload: AiSsePayloadByType[K];
    timestamp: string;
  };
}[TType];
