import type { AgentRuntimeInput, AgentRuntimeResult, LlmMessage, LlmProvider } from './types';

function buildMessages(input: AgentRuntimeInput): LlmMessage[] {
  return [
    {
      role: 'system',
      content: `${input.systemPrompt}

You are running inside Orbitchat Phase 4A. Keep responses concise and friendly.
You may help with casual chat, jokes, and simple text games like tic-tac-toe.
Do not claim that you can send messages, follow users, or write business data.`,
    },
    ...input.history,
    {
      role: 'user',
      content: input.userMessage,
    },
  ];
}

export class AgentOrchestrator {
  constructor(
    private readonly provider: LlmProvider,
    private readonly model: string
  ) {}

  async run(input: AgentRuntimeInput): Promise<AgentRuntimeResult> {
    const content = await this.provider.generate({
      model: this.model,
      messages: buildMessages(input),
    });

    return {
      content,
      toolCalls: [],
    };
  }
}
