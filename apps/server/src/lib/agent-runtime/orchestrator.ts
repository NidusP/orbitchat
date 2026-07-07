import { AppError } from '../errors';
import { TICTACTOE_AGENT_INSTRUCTIONS } from './tic-tac-toe';
import type {
  AgentRuntimeInput,
  AgentRuntimeResult,
  AgentToolExecutor,
  LlmMessage,
  LlmProvider,
} from './types';

const MAX_TOOL_ROUNDS = 5;

function buildMessages(input: AgentRuntimeInput): LlmMessage[] {
  const toolHint = input.tools
    ? `You have tools:
- search_contact: find users (read-only, runs immediately)
- play_tictactoe: tic-tac-toe; user is X, you are O; call start/status/move (see game rules below)
- send_dm: send a direct message (requires user approval)
- create_post: publish a feed post (requires user approval)
- follow_user / unfollow_user: change follow state (requires user approval)
Use tools when the user asks to find someone, play tic-tac-toe, send a message, post, or follow/unfollow. For write tools, extract target username and content from the user message.

${TICTACTOE_AGENT_INSTRUCTIONS}`
    : '';

  return [
    {
      role: 'system',
      content: `${input.systemPrompt}

You are running inside Orbitchat. Keep responses concise and friendly.
${toolHint}`.trim(),
    },
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

export class AgentOrchestrator {
  constructor(
    private readonly provider: LlmProvider,
    private readonly model: string,
    private readonly toolExecutor?: AgentToolExecutor
  ) {}

  async run(input: AgentRuntimeInput): Promise<AgentRuntimeResult> {
    const useTools = Boolean(input.tools && input.toolContext && this.toolExecutor);
    const messages = buildMessages(input);
    const toolCalls: AgentRuntimeResult['toolCalls'] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const completion = await this.provider.chat({
        model: this.model,
        messages,
        tools: useTools,
      });

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
        const execution = await this.toolExecutor!(
          call.name,
          args,
          input.toolContext!
        );
        toolCalls.push(execution.toolCall);
        messages.push({
          ...execution.toolMessage,
          toolCallId: call.id,
        });
      }
    }

    const fallback = await this.provider.chat({
      model: this.model,
      messages,
      tools: false,
    });
    const content = fallback.content?.trim();
    if (!content) {
      throw new AppError('LLM_EMPTY_RESPONSE', 'Local model returned an empty response', 502);
    }
    return { content, toolCalls };
  }
}
