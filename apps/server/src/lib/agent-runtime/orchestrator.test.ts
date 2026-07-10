import { describe, expect, test } from 'bun:test';
import { AgentOrchestrator } from './orchestrator';
import type { LlmChatInput, LlmChatResult, LlmProvider } from './types';

class CapturingLlmProvider implements LlmProvider {
  lastInput: LlmChatInput | undefined;

  async chat(input: LlmChatInput): Promise<LlmChatResult> {
    this.lastInput = input;
    return { content: 'mock reply', toolCalls: [] };
  }

  async chatStream(input: LlmChatInput): Promise<LlmChatResult> {
    this.lastInput = input;
    return { content: 'mock reply', toolCalls: [] };
  }
}

describe('AgentOrchestrator buildMessages', () => {
  test('includes read-only profile and post tools when tools are enabled', async () => {
    const provider = new CapturingLlmProvider();
    const orchestrator = new AgentOrchestrator(provider, 'test-model');

    await orchestrator.run({
      systemPrompt: 'You are Orbit Guide.',
      history: [],
      userMessage: 'What did I post recently?',
      tools: true,
      toolContext: { conversationId: 'conv-1', userId: 'user-1' },
    });

    const systemContent = provider.lastInput?.messages[0]?.content ?? '';
    expect(systemContent).toContain('get_my_profile');
    expect(systemContent).toContain('list_my_recent_posts');
    expect(systemContent).toContain('search_my_posts');
    expect(systemContent).toContain('search_help_docs');
    expect(systemContent).toContain('did I post about X');
    expect(systemContent).toContain('list_user_recent_posts');
    expect(systemContent).toContain('NEVER fabricate posts, follower counts, or profile data');
    expect(systemContent).toContain('### Platform data');
    expect(systemContent).toContain('### Social write actions');
    expect(systemContent).toContain('### Games');
    expect(systemContent).toContain('### Memory');
  });

  test('appends current session user block when userContext is provided', async () => {
    const provider = new CapturingLlmProvider();
    const orchestrator = new AgentOrchestrator(provider, 'test-model');

    await orchestrator.run({
      systemPrompt: 'You are Orbit Guide.',
      history: [],
      userMessage: 'Hello',
      userContext: {
        username: 'luna',
        displayName: 'Luna Star',
      },
    });

    const systemContent = provider.lastInput?.messages[0]?.content ?? '';
    expect(systemContent).toContain('## Current session user');
    expect(systemContent).toContain('- username: @luna');
    expect(systemContent).toContain('- display name: Luna Star');
  });

  test('omits tool hints when tools are disabled', async () => {
    const provider = new CapturingLlmProvider();
    const orchestrator = new AgentOrchestrator(provider, 'test-model');

    await orchestrator.run({
      systemPrompt: 'You are Orbit Guide.',
      history: [],
      userMessage: 'Hello',
      tools: false,
    });

    const systemContent = provider.lastInput?.messages[0]?.content ?? '';
    expect(systemContent).not.toContain('get_my_profile');
    expect(systemContent).not.toContain('NEVER fabricate posts');
  });

  test('includes remember_fact write tool hint when tools are enabled', async () => {
    const provider = new CapturingLlmProvider();
    const orchestrator = new AgentOrchestrator(provider, 'test-model');

    await orchestrator.run({
      systemPrompt: 'You are Orbit Guide.',
      history: [],
      userMessage: 'Remember this',
      tools: true,
      toolContext: { conversationId: 'conv-1', userId: 'user-1' },
    });

    const systemContent = provider.lastInput?.messages[0]?.content ?? '';
    expect(systemContent).toContain('remember_fact');
    expect(systemContent).toContain('injected automatically');
  });

  test('injects memory block when memories are provided', async () => {
    const provider = new CapturingLlmProvider();
    const orchestrator = new AgentOrchestrator(provider, 'test-model');

    await orchestrator.run({
      systemPrompt: 'You are Orbit Guide.',
      history: [],
      userMessage: 'Hello',
      memories: [
        { kind: 'nickname', content: 'Call me Orbit' },
        { kind: 'preference', content: 'Prefers short replies' },
      ],
    });

    const systemContent = provider.lastInput?.messages[0]?.content ?? '';
    expect(systemContent).toContain('## 关于该用户的已知事实（用户可删除）');
    expect(systemContent).toContain('- [nickname] Call me Orbit');
    expect(systemContent).toContain('- [preference] Prefers short replies');
  });

  test('injects conversation summary block before history', async () => {
    const provider = new CapturingLlmProvider();
    const orchestrator = new AgentOrchestrator(provider, 'test-model');

    await orchestrator.run({
      systemPrompt: 'You are Orbit Guide.',
      history: [{ role: 'user', content: 'Recent question' }],
      userMessage: 'Follow up',
      conversationSummary: 'User discussed travel plans to Kyoto earlier.',
    });

    const summaryMessage = provider.lastInput?.messages[1];
    expect(summaryMessage?.role).toBe('system');
    expect(summaryMessage?.content).toContain('## Earlier in this conversation (summary)');
    expect(summaryMessage?.content).toContain('travel plans to Kyoto');
    expect(provider.lastInput?.messages[2]).toEqual({
      role: 'user',
      content: 'Recent question',
    });
  });
});
