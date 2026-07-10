import { AppError } from '../../../lib/errors';
import { AGENT_TOOL_DEFINITIONS } from '../tools';
import type {
  LlmChatInput,
  LlmChatResult,
  LlmMessage,
  LlmProvider,
  LlmStreamHandlers,
  LlmToolCall,
} from '../types';

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

interface StreamDeltaChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: ApiToolCall[];
    };
  }>;
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
    private readonly timeoutMs: number,
    private readonly apiKey?: string
  ) {}

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    return this.chatStream(input, { onDelta: () => {} });
  }

  async chatStream(input: LlmChatInput, handlers: LlmStreamHandlers): Promise<LlmChatResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const relayAbort = (): void => controller.abort();
    input.signal?.addEventListener('abort', relayAbort, { once: true });

    try {
      const body: Record<string, unknown> = {
        model: input.model,
        messages: input.messages.map(toApiMessage),
        stream: true,
      };

      if (input.tools) {
        body.tools = AGENT_TOOL_DEFINITIONS;
      }

      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
        throw new AppError(
          'LLM_REQUEST_FAILED',
          payload?.error?.message ?? 'Local model request failed',
          502
        );
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let content = '';
        const toolCallsByIndex = new Map<number, LlmToolCall>();

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';

          for (const eventRaw of events) {
            const lines = eventRaw
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.startsWith('data: '))
              .map((line) => line.slice(6));

            for (const data of lines) {
              if (!data || data === '[DONE]') {
                continue;
              }
              const parsed = JSON.parse(data) as StreamDeltaChunk;
              const delta = parsed.choices?.[0]?.delta;
              if (!delta) {
                continue;
              }
              if (delta.content) {
                content += delta.content;
                handlers.onDelta(delta.content);
              }
              for (const toolDelta of delta.tool_calls ?? []) {
                const toolDeltaWithIndex = toolDelta as unknown as {
                  index?: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                };
                const index = Number(toolDeltaWithIndex.index ?? 0);
                const current = toolCallsByIndex.get(index) ?? {
                  id: toolDeltaWithIndex.id ?? '',
                  name: toolDeltaWithIndex.function?.name ?? '',
                  arguments: '',
                };
                current.id = toolDeltaWithIndex.id || current.id;
                current.name = toolDeltaWithIndex.function?.name || current.name;
                current.arguments += toolDeltaWithIndex.function?.arguments ?? '';
                toolCallsByIndex.set(index, current);
              }
            }
          }
        }

        const toolCalls = [...toolCallsByIndex.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, value]) => value);

        if (!content && toolCalls.length === 0) {
          throw new AppError('LLM_EMPTY_RESPONSE', 'Local model returned an empty response', 502);
        }

        return {
          content: content || null,
          toolCalls,
        };
      }
      throw new AppError('LLM_EMPTY_RESPONSE', 'Local model returned an empty response', 502);
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
