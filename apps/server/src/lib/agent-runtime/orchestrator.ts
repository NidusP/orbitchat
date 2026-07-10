import { AppError } from '../errors';
import { composeToolHint } from './prompt-modules';
import type {
  AgentRunCallbacks,
  AgentRuntimeInput,
  AgentRuntimeResult,
  AgentToolExecutor,
  LlmMessage,
  LlmProvider,
} from './types';

const MAX_TOOL_ROUNDS = 5;

function buildUserContextBlock(userContext: NonNullable<AgentRuntimeInput['userContext']>): string {
  return `## Current session user
- username: @${userContext.username}
- display name: ${userContext.displayName}`;
}

function buildMemoryBlock(memories: NonNullable<AgentRuntimeInput['memories']>): string {
  const lines = memories.map((memory) => `- [${memory.kind}] ${memory.content}`);
  return `## 关于该用户的已知事实（用户可删除）
${lines.join('\n')}`;
}

function buildMessages(input: AgentRuntimeInput): LlmMessage[] {
  const toolHint = input.tools ? composeToolHint() : '';

  const userContextBlock = input.userContext ? buildUserContextBlock(input.userContext) : '';
  const memoryBlock =
    input.memories && input.memories.length > 0 ? buildMemoryBlock(input.memories) : '';
  const summaryBlock = input.conversationSummary
    ? `## Earlier in this conversation (summary)\n${input.conversationSummary}`
    : '';

  return [
    {
      role: 'system',
      content: `${input.systemPrompt}

You are running inside Orbitchat. Keep responses concise and friendly.
${toolHint}
${userContextBlock}
${memoryBlock}`.trim(),
    },
    ...(summaryBlock
      ? [
          {
            role: 'system' as const,
            content: summaryBlock,
          },
        ]
      : []),
    ...input.history,
    {
      role: 'user',
      content: input.userMessage,
    },
  ];
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

async function invokeProvider(
  provider: LlmProvider,
  input: {
    model: string;
    messages: LlmMessage[];
    tools: boolean;
  },
  callbacks?: AgentRunCallbacks
) {
  return provider.chatStream(
    {
      model: input.model,
      messages: input.messages,
      tools: input.tools,
    },
    {
      onDelta: (text) => {
        void callbacks?.onDelta?.(text);
      },
    }
  );
}

export class AgentOrchestrator {
  constructor(
    private readonly provider: LlmProvider,
    private readonly model: string,
    private readonly toolExecutor?: AgentToolExecutor
  ) {}

  async run(
    input: AgentRuntimeInput,
    callbacks?: AgentRunCallbacks
  ): Promise<AgentRuntimeResult> {
    const useTools = Boolean(input.tools && input.toolContext && this.toolExecutor);
    const messages = buildMessages(input);
    const toolCalls: AgentRuntimeResult['toolCalls'] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const completion = await invokeProvider(
        this.provider,
        {
          model: this.model,
          messages,
          tools: useTools,
        },
        callbacks
      );

      if (!useTools || completion.toolCalls.length === 0) {
        const content = completion.content?.trim();
        if (!content) {
          throw new AppError('LLM_EMPTY_RESPONSE', 'Local model returned an empty response', 502);
        }
        return { content, toolCalls };
      }

      messages.push({
        role: 'assistant',
        content: completion.content ?? '',
        toolCalls: completion.toolCalls,
      });

      for (const call of completion.toolCalls) {
        const args = parseToolArguments(call.arguments);
        await callbacks?.onToolStarted?.(call.name, args);
        const execution = await this.toolExecutor!(call.name, args, input.toolContext!);
        toolCalls.push(execution.toolCall);
        await callbacks?.onToolCall?.(execution.toolCall);
        messages.push({
          ...execution.toolMessage,
          toolCallId: call.id,
        });
      }
    }

    const fallback = await invokeProvider(
      this.provider,
      {
        model: this.model,
        messages,
        tools: false,
      },
      callbacks
    );
    const content = fallback.content?.trim();
    if (!content) {
      throw new AppError('LLM_EMPTY_RESPONSE', 'Local model returned an empty response', 502);
    }
    return { content, toolCalls };
  }
}
