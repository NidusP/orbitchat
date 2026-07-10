process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { AgentRuntimeInput } from '../../lib/agent-runtime/types';
import { AgentOrchestrator } from '../../lib/agent-runtime/orchestrator';
import { E2eMockLlmProvider } from '../../lib/agent-runtime/providers/e2e-mock';

const memoryService = await import('./memory-service');
const summaryService = await import('./summary-service');
const userService = await import('../user-service');
const conversationServiceModule = await import('./conversation-service');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const AGENT_ID = '22222222-2222-4222-8222-222222222222';
const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const USER_MESSAGE_ID = '44444444-4444-4444-8444-444444444444';
const ASSISTANT_MESSAGE_ID = '55555555-5555-4555-8555-555555555555';

const dbModule = await import('../../db');

const conversationRow = {
  id: CONVERSATION_ID,
  userId: USER_ID,
  agentId: AGENT_ID,
  title: 'Existing chat',
  tictactoeData: null,
  lastMessageAt: new Date('2026-07-09T10:00:00.000Z'),
  createdAt: new Date('2026-07-09T09:00:00.000Z'),
  updatedAt: new Date('2026-07-09T10:00:00.000Z'),
};

const agentRow = {
  id: AGENT_ID,
  slug: 'orbit-guide',
  name: '小轨',
  description: 'Built-in helper',
  systemPrompt: 'You are Orbit Guide.',
  isBuiltin: true,
  createdAt: new Date('2026-07-03T10:00:00.000Z'),
  updatedAt: new Date('2026-07-03T10:00:00.000Z'),
};

class CapturingOrchestrator extends AgentOrchestrator {
  lastInput: AgentRuntimeInput | undefined;

  constructor() {
    super(new E2eMockLlmProvider(), 'test-model');
  }

  override async run(input: AgentRuntimeInput) {
    this.lastInput = input;
    return {
      content: 'Mock assistant reply.',
      toolCalls: [],
    };
  }
}

function mockConversationDb(): void {
  spyOn(dbModule.db.query.aiConversations, 'findFirst').mockImplementation(
    () => Promise.resolve(conversationRow) as never
  );

  spyOn(dbModule.db.query.agents, 'findFirst').mockImplementation(
    () => Promise.resolve(agentRow) as never
  );

  let insertCount = 0;
  spyOn(dbModule.db, 'insert').mockImplementation(
    () =>
      ({
        values: () => ({
          onConflictDoUpdate: () => Promise.resolve(),
          returning: async () => {
            insertCount += 1;
            if (insertCount === 1) {
              return [
                {
                  id: USER_MESSAGE_ID,
                  conversationId: CONVERSATION_ID,
                  role: 'user',
                  content: 'hello',
                  toolName: null,
                  createdAt: new Date('2026-07-09T10:01:00.000Z'),
                },
              ];
            }
            return [
              {
                id: ASSISTANT_MESSAGE_ID,
                conversationId: CONVERSATION_ID,
                role: 'assistant',
                content: 'Mock assistant reply.',
                toolName: null,
                createdAt: new Date('2026-07-09T10:01:02.000Z'),
              },
            ];
          },
        }),
      }) as never
  );

  spyOn(dbModule.db, 'update').mockImplementation(
    () =>
      ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }) as never
  );
}

describe('createAiMessageAndRun', () => {
  beforeEach(() => {
    mock.restore();
    mockConversationDb();
    spyOn(conversationServiceModule, 'ensureBuiltinAgents').mockImplementation(async () => {});
  });

  test('passes userContext, memories, and conversationSummary to orchestrator', async () => {
    spyOn(summaryService, 'maybeRefreshConversationSummary').mockImplementation(async () => {});
    spyOn(summaryService, 'loadRuntimeContext').mockImplementation(async () => ({
      history: [{ role: 'user', content: 'Earlier question' }],
      conversationSummary: 'User discussed Kyoto travel plans.',
    }));

    spyOn(userService, 'getUserById').mockImplementation(async () => ({
      id: USER_ID,
      username: 'alice',
      email: 'alice@example.com',
      isActive: true,
      createdAt: '2026-07-06T10:00:00.000Z',
      updatedAt: '2026-07-06T10:00:00.000Z',
    }));
    spyOn(userService, 'getProfileByUserId').mockImplementation(async () => ({
      id: '66666666-6666-4666-8666-666666666666',
      userId: USER_ID,
      displayName: 'Alice',
      bio: null,
      avatarUrl: null,
      createdAt: '2026-07-06T10:00:00.000Z',
      updatedAt: '2026-07-06T10:00:00.000Z',
    }));
    spyOn(memoryService, 'listMemoriesForUser').mockImplementation(async () => [
      {
        id: '77777777-7777-4777-8777-777777777777',
        userId: USER_ID,
        agentId: null,
        kind: 'nickname',
        content: 'Call me Orbit',
        source: 'user_explicit',
        conversationId: null,
        createdAt: '2026-07-09T10:00:00.000Z',
        updatedAt: '2026-07-09T10:00:00.000Z',
        deletedAt: null,
      },
    ]);

    const orchestrator = new CapturingOrchestrator();

    const result = await conversationServiceModule.createAiMessageAndRun({
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      body: { content: 'hello' },
      orchestrator,
    });

    expect(orchestrator.lastInput?.userContext).toEqual({
      username: 'alice',
      displayName: 'Alice',
    });
    expect(orchestrator.lastInput?.memories).toEqual([
      { kind: 'nickname', content: 'Call me Orbit' },
    ]);
    expect(orchestrator.lastInput?.conversationSummary).toBe(
      'User discussed Kyoto travel plans.'
    );
    expect(orchestrator.lastInput?.toolContext).toEqual({
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
    });
    expect(result.assistantMessage.content).toBe('Mock assistant reply.');
  });
});
