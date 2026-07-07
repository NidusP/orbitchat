export type LlmMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
  toolCallId?: string;
  toolCalls?: LlmToolCall[];
}

export interface LlmChatInput {
  model: string;
  messages: LlmMessage[];
  tools?: boolean;
  signal?: AbortSignal;
}

export interface LlmChatResult {
  content: string | null;
  toolCalls: LlmToolCall[];
}

export interface LlmProvider {
  chat(input: LlmChatInput): Promise<LlmChatResult>;
}

export interface AgentToolContext {
  conversationId: string;
  userId: string;
}

export interface AgentToolExecution {
  toolMessage: LlmMessage;
  toolCall: AgentToolCallResult;
}

export type AgentToolExecutor = (
  toolName: string,
  args: Record<string, unknown>,
  context: AgentToolContext
) => Promise<AgentToolExecution>;

export interface AgentRuntimeInput {
  systemPrompt: string;
  history: LlmMessage[];
  userMessage: string;
  tools?: boolean;
  toolContext?: AgentToolContext;
}

export interface AgentRuntimeResult {
  content: string;
  toolCalls: AgentToolCallResult[];
}

export interface AgentToolCallResult {
  toolName: string;
  input: unknown;
  output: unknown;
}
