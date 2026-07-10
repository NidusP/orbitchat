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

export interface LlmStreamHandlers {
  onDelta: (text: string) => void;
}

export interface LlmProvider {
  chat(input: LlmChatInput): Promise<LlmChatResult>;
  chatStream(input: LlmChatInput, handlers: LlmStreamHandlers): Promise<LlmChatResult>;
}

export interface AgentRunCallbacks {
  onDelta?: (text: string) => void | Promise<void>;
  onToolStarted?: (toolName: string, input: unknown) => void | Promise<void>;
  onToolCall?: (result: AgentToolCallResult) => void | Promise<void>;
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
  conversationSummary?: string;
  tools?: boolean;
  toolContext?: AgentToolContext;
  userContext?: {
    username: string;
    displayName: string;
  };
  memories?: Array<{
    kind: string;
    content: string;
  }>;
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
