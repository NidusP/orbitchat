process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.LLM_BASE_URL = 'http://localhost:11434/v1';
process.env.LLM_MODEL = 'test-model';
process.env.LLM_TIMEOUT_MS = '1000';
process.env.AI_MAX_CONCURRENT_RUNS = '2';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Agent, AiConversation, AiMessage } from '@orbitchat/shared-types';
import { Hono } from 'hono';
import { handleError } from '../../middleware/error';

const jwtLib = await import('../../lib/jwt');
const sessionService = await import('../../services/session-service');
const aiService = await import('../../services/ai/conversation-service');
const toolCallService = await import('../../services/ai/tool-call-service');
const { aiRouter } = await import('./ai');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const AGENT_ID = '22222222-2222-4222-8222-222222222222';
const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const USER_MESSAGE_ID = '44444444-4444-4444-8444-444444444444';
const ASSISTANT_MESSAGE_ID = '55555555-5555-4555-8555-555555555555';

const sampleAgent: Agent = {
  id: AGENT_ID,
  slug: 'orbit-guide',
  name: '小轨',
  description: 'Built-in helper',
  systemPrompt: 'Be helpful',
  isBuiltin: true,
  createdAt: '2026-07-03T10:00:00.000Z',
  updatedAt: '2026-07-03T10:00:00.000Z',
};

const sampleConversation: AiConversation = {
  id: CONVERSATION_ID,
  userId: USER_ID,
  agentId: AGENT_ID,
  title: 'Hello',
  lastMessageAt: null,
  createdAt: '2026-07-03T10:00:00.000Z',
  updatedAt: '2026-07-03T10:00:00.000Z',
};

const userMessage: AiMessage = {
  id: USER_MESSAGE_ID,
  conversationId: CONVERSATION_ID,
  role: 'user',
  content: 'Tell me a joke',
  toolName: null,
  createdAt: '2026-07-03T10:01:00.000Z',
};

const assistantMessage: AiMessage = {
  id: ASSISTANT_MESSAGE_ID,
  conversationId: CONVERSATION_ID,
  role: 'assistant',
  content: 'Why did the satellite bring a map? It needed to stay in orbit.',
  toolName: null,
  createdAt: '2026-07-03T10:01:02.000Z',
};

function createApp(): Hono {
  const app = new Hono();
  app.route('/ai', aiRouter);
  app.onError((error, c) => handleError(error, c));
  return app;
}

function mockAuth(): void {
  spyOn(jwtLib, 'verifyAccessToken').mockImplementation(async () => ({
    sub: USER_ID,
    sid: 'session-1',
    platform: 'web',
    email: 'orbit@example.com',
    exp: 9999999999,
  }));
  spyOn(sessionService, 'assertValidSession').mockImplementation(async () => ({
    id: 'session-1',
    userId: USER_ID,
    deviceId: 'device-1',
    platform: 'web',
    deviceName: 'Chrome',
    isTrusted: true,
    refreshTokenHash: 'hash',
    lastActiveAt: new Date('2026-06-20T00:00:00.000Z'),
    expiresAt: new Date('2026-07-20T00:00:00.000Z'),
    revokedAt: null,
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
  }));
  spyOn(sessionService, 'touchSession').mockImplementation(async () => {});
}

describe('aiRouter', () => {
  beforeEach(() => {
    mock.restore();
    mockAuth();
    spyOn(aiService, 'listAgents').mockImplementation(async () => [sampleAgent]);
    spyOn(aiService, 'listAiConversations').mockImplementation(async () => ({
      items: [sampleConversation],
      nextCursor: null,
    }));
    spyOn(aiService, 'createAiConversation').mockImplementation(async () => sampleConversation);
    spyOn(aiService, 'listAiMessages').mockImplementation(async () => ({
      items: [userMessage, assistantMessage],
      nextCursor: null,
    }));
    spyOn(aiService, 'createAiMessageAndRun').mockImplementation(async () => ({
      userMessage,
      assistantMessage,
      toolCalls: [
        {
          toolName: 'search_contact',
          input: { query: 'luna' },
          output: { items: [] },
        },
      ],
    }));
  });

  test('lists agents', async () => {
    const app = createApp();
    const response = await app.request('/ai/agents', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const body = (await response.json()) as { code: string; data: Agent[] };

    expect(response.status).toBe(200);
    expect(body.code).toBe('SUCCESS');
    expect(body.data[0]?.slug).toBe('orbit-guide');
  });

  test('creates an AI conversation', async () => {
    const createSpy = spyOn(aiService, 'createAiConversation');
    const app = createApp();
    const response = await app.request('/ai/conversations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agentId: AGENT_ID, title: 'Hello' }),
    });
    const body = (await response.json()) as { code: string; data: AiConversation };

    expect(response.status).toBe(201);
    expect(body.data.id).toBe(CONVERSATION_ID);
    expect(createSpy).toHaveBeenCalledWith(USER_ID, { agentId: AGENT_ID, title: 'Hello' });
  });

  test('lists AI messages', async () => {
    const listSpy = spyOn(aiService, 'listAiMessages');
    const app = createApp();
    const response = await app.request(`/ai/conversations/${CONVERSATION_ID}/messages?limit=10`, {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const body = (await response.json()) as { code: string; data: { items: AiMessage[] } };

    expect(response.status).toBe(200);
    expect(body.data.items[1]?.role).toBe('assistant');
    expect(listSpy).toHaveBeenCalledWith(CONVERSATION_ID, USER_ID, { limit: 10 });
  });

  test('streams AI message events', async () => {
    const app = createApp();
    const response = await app.request(`/ai/conversations/${CONVERSATION_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'search_contact: luna' }),
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(text).toContain('event: tool.call');
    expect(text).toContain('event: message.delta');
    expect(text).toContain('event: message.done');
    expect(text).toContain(ASSISTANT_MESSAGE_ID);
  });

  test('rejects invalid agent id', async () => {
    const app = createApp();
    const response = await app.request('/ai/conversations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agentId: 'not-a-uuid' }),
    });
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('rejects unauthenticated AI conversations list', async () => {
    const app = createApp();
    const response = await app.request('/ai/conversations');
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  test('approves a pending tool call', async () => {
    const approveSpy = spyOn(toolCallService, 'approveAiToolCall').mockImplementation(async () => ({
      id: '66666666-6666-4666-8666-666666666666',
      conversationId: CONVERSATION_ID,
      requestedByUserId: USER_ID,
      toolName: 'create_post',
      status: 'executed',
      input: { content: 'Hello feed' },
      output: { postId: '77777777-7777-4777-8777-777777777777' },
      error: null,
      createdAt: '2026-07-06T10:00:00.000Z',
      updatedAt: '2026-07-06T10:01:00.000Z',
      confirmedAt: '2026-07-06T10:00:30.000Z',
      executedAt: '2026-07-06T10:01:00.000Z',
    }));
    const app = createApp();
    const response = await app.request(
      '/ai/tool-calls/66666666-6666-4666-8666-666666666666/approve',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
      }
    );
    const body = (await response.json()) as { code: string; data: { status: string } };

    expect(response.status).toBe(200);
    expect(body.data.status).toBe('executed');
    expect(approveSpy).toHaveBeenCalledWith(
      '66666666-6666-4666-8666-666666666666',
      USER_ID
    );
  });
});
