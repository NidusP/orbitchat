import { AppError } from '../../../lib/errors';
import type { LlmGenerateInput, LlmProvider } from '../types';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export class OpenAiCompatibleProvider implements LlmProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number
  ) {}

  async generate(input: LlmGenerateInput): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const relayAbort = (): void => controller.abort();
    input.signal?.addEventListener('abort', relayAbort, { once: true });

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          stream: false,
        }),
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => null)) as ChatCompletionResponse | null;

      if (!response.ok) {
        throw new AppError(
          'LLM_REQUEST_FAILED',
          body?.error?.message ?? 'Local model request failed',
          502
        );
      }

      const content = body?.choices?.[0]?.message?.content;
      if (!content) {
        throw new AppError('LLM_EMPTY_RESPONSE', 'Local model returned an empty response', 502);
      }

      return content;
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
