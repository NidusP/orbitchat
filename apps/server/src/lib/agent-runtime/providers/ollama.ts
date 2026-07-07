import { AppError } from '../../../lib/errors';
import { AGENT_TOOL_DEFINITIONS } from '../tools';
import type { LlmChatInput, LlmChatResult, LlmMessage, LlmProvider } from '../types';

interface ApiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: ApiToolCall[];
    };
  }>;
  error?: {
    message?: string;
  };
}

function toApiMessage(message: LlmMessage): Record<string, unknown> {
  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: message.content,
      tool_call_id: message.toolCallId,
    };
  }

  if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: {
          name: call.name,
          arguments: call.arguments,
        },
      })),
    };
  }

  return {
    role: message.role,
    content: message.content,
  };
}

export class OpenAiCompatibleProvider implements LlmProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number
  ) {}

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const relayAbort = (): void => controller.abort();
    input.signal?.addEventListener('abort', relayAbort, { once: true });

    try {
      const body: Record<string, unknown> = {
        model: input.model,
        messages: input.messages.map(toApiMessage),
        stream: false,
      };

      if (input.tools) {
        body.tools = AGENT_TOOL_DEFINITIONS;
      }

      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as ChatCompletionResponse | null;

      if (!response.ok) {
        throw new AppError(
          'LLM_REQUEST_FAILED',
          payload?.error?.message ?? 'Local model request failed',
          502
        );
      }

      const message = payload?.choices?.[0]?.message;
      if (!message) {
        throw new AppError('LLM_EMPTY_RESPONSE', 'Local model returned an empty response', 502);
      }

      const toolCalls =
        message.tool_calls?.map((call) => ({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        })) ?? [];

      if (!message.content && toolCalls.length === 0) {
        throw new AppError('LLM_EMPTY_RESPONSE', 'Local model returned an empty response', 502);
      }

      return {
        content: message.content ?? null,
        toolCalls,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new AppError('LLM_TIMEOUT', 'Local model request timed out', 504);
      }
      throw new AppError('LLM_UNAVAILABLE', 'Local model service is unavailable', 502);
    } finally {
      clearTimeout(timeout);
      input.signal?.removeEventListener('abort', relayAbort);
    }
  }
}
