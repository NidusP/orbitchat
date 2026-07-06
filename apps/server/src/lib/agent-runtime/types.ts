export type LlmMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

export interface LlmGenerateInput {
  model: string;
  messages: LlmMessage[];
  signal?: AbortSignal;
}

export interface LlmProvider {
  generate(input: LlmGenerateInput): Promise<string>;
}

export interface AgentRuntimeInput {
  systemPrompt: string;
  history: LlmMessage[];
  userMessage: string;
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
