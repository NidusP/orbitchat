process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.LLM_E2E_MOCK = 'false';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { AiConversationSummary } from '../../db/schema/ai-conversation-summaries';
import type { LlmChatInput, LlmChatResult, LlmProvider } from '../../lib/agent-runtime/types';
import { env } from '../../env';
import {
  generateSummaryText,
  getConversationSummary,
  loadRuntimeContext,
  maybeRefreshConversationSummary,
} from './summary-service';

const CONVERSATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MESSAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const dbModule = await import('../../db');

class FixedSummaryProvider implements LlmProvider {
  async chat(_input: LlmChatInput): Promise<LlmChatResult> {
    return { content: 'mock summary text', toolCalls: [] };
  }

  async chatStream(_input: LlmChatInput): Promise<LlmChatResult> {
    return { content: 'mock summary text', toolCalls: [] };
  }
}

function sampleSummaryRow(overrides: Partial<AiConversationSummary> = {}): AiConversationSummary {
  return {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    conversationId: CONVERSATION_ID,
    summary: 'Earlier the user asked about travel.',
    upToMessageId: MESSAGE_ID,
    createdAt: new Date('2026-07-09T10:00:00.000Z'),
    updatedAt: new Date('2026-07-09T10:00:00.000Z'),
    ...overrides,
  };
}

function buildMessageRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: `message ${index + 1}`,
  }));
}

describe('summary-service', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('maybeRefreshConversationSummary skips when <=30 messages', async () => {
    const insertSpy = spyOn(dbModule.db, 'insert');

    spyOn(dbModule.db, 'select').mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(buildMessageRows(30)),
            }),
          }),
        }) as never
    );

    await maybeRefreshConversationSummary(CONVERSATION_ID, new FixedSummaryProvider());
    expect(insertSpy).not.toHaveBeenCalled();
  });

  test('maybeRefreshConversationSummary creates summary when >30 messages', async () => {
    const messages = buildMessageRows(31);
    const insertValues = mock(() => ({
      onConflictDoUpdate: () => Promise.resolve(),
    }));

    spyOn(dbModule.db, 'select').mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(messages),
            }),
          }),
        }) as never
    );

    spyOn(dbModule.db.query.aiConversationSummaries, 'findFirst').mockImplementation(
      () => Promise.resolve(undefined) as never
    );

    spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: insertValues,
        }) as never
    );

    await maybeRefreshConversationSummary(CONVERSATION_ID, new FixedSummaryProvider());

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: CONVERSATION_ID,
        summary: 'mock summary text',
        upToMessageId: messages[10]?.id,
      })
    );
  });

  test('getConversationSummary returns stored summary', async () => {
    const row = sampleSummaryRow();

    spyOn(dbModule.db.query.aiConversationSummaries, 'findFirst').mockImplementation(
      () => Promise.resolve(row) as never
    );

    const summary = await getConversationSummary(CONVERSATION_ID);
    expect(summary).toEqual({
      summary: row.summary,
      upToMessageId: row.upToMessageId,
    });
  });

  test('generateSummaryText uses deterministic mock when LLM_E2E_MOCK is true', async () => {
    const previous = env.LLM_E2E_MOCK;
    env.LLM_E2E_MOCK = true;

    try {
      const summary = await generateSummaryText(
        [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi' },
        ],
        undefined,
        new FixedSummaryProvider()
      );

      expect(summary).toBe('[e2e:summary] 2 messages');
    } finally {
      env.LLM_E2E_MOCK = previous;
    }
  });

  test('getConversationSummary returns null when summary table is missing', async () => {
    spyOn(dbModule.db.query.aiConversationSummaries, 'findFirst').mockImplementation(
      () =>
        Promise.reject({ code: '42P01', message: 'relation does not exist' }) as never
    );

    const summary = await getConversationSummary(CONVERSATION_ID);
    expect(summary).toBeNull();
  });

  test('loadRuntimeContext returns summary and recent history', async () => {
    const row = sampleSummaryRow();

    spyOn(dbModule.db.query.aiConversationSummaries, 'findFirst').mockImplementation(
      () => Promise.resolve(row) as never
    );

    spyOn(dbModule.db, 'select').mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      role: 'assistant',
                      content: 'Latest assistant reply',
                    },
                    {
                      role: 'user',
                      content: 'Latest user question',
                    },
                  ]),
              }),
            }),
          }),
        }) as never
    );

    const context = await loadRuntimeContext(CONVERSATION_ID);

    expect(context.conversationSummary).toBe(row.summary);
    expect(context.history).toEqual([
      { role: 'user', content: 'Latest user question' },
      { role: 'assistant', content: 'Latest assistant reply' },
    ]);
  });
});
