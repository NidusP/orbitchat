import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

const memoryService = await import('./memory-service');
const toolCallService = await import('./tool-call-service');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const TOOL_CALL_ID = '44444444-4444-4444-8444-444444444444';

const pendingRememberFactRow = {
  id: TOOL_CALL_ID,
  conversationId: CONVERSATION_ID,
  requestedByUserId: USER_ID,
  toolName: 'remember_fact',
  status: 'pending' as const,
  input: { kind: 'nickname', content: 'Call me Orbit' },
  output: null,
  error: null,
  createdAt: new Date('2026-07-06T10:00:00.000Z'),
  updatedAt: new Date('2026-07-06T10:00:00.000Z'),
  confirmedAt: null,
  executedAt: null,
};

const dbModule = await import('../../db');

describe('approveAiToolCall remember_fact', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('approve creates memory via memory-service', async () => {
    spyOn(dbModule.db, 'select').mockImplementation(
      () =>
        ({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => [{ toolCall: pendingRememberFactRow }],
              }),
            }),
          }),
        }) as never
    );

    let updateCount = 0;
    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: async () => {
                updateCount += 1;
                if (updateCount === 1) {
                  return [{ ...pendingRememberFactRow, status: 'approved' as const }];
                }
                return [
                  {
                    ...pendingRememberFactRow,
                    status: 'executed' as const,
                    output: {
                      memoryId: '77777777-7777-4777-8777-777777777777',
                      kind: 'nickname',
                      content: 'Call me Orbit',
                    },
                    executedAt: new Date('2026-07-06T10:00:01.000Z'),
                  },
                ];
              },
            }),
          }),
        }) as never
    );

    const createMemorySpy = spyOn(memoryService, 'createMemory').mockImplementation(async () => ({
      id: '77777777-7777-4777-8777-777777777777',
      userId: USER_ID,
      agentId: null,
      kind: 'nickname',
      content: 'Call me Orbit',
      source: 'tool',
      conversationId: CONVERSATION_ID,
      createdAt: '2026-07-06T10:00:00.000Z',
      updatedAt: '2026-07-06T10:00:00.000Z',
      deletedAt: null,
    }));

    const result = await toolCallService.approveAiToolCall(TOOL_CALL_ID, USER_ID);

    expect(createMemorySpy).toHaveBeenCalledWith(USER_ID, {
      kind: 'nickname',
      content: 'Call me Orbit',
      source: 'tool',
      conversationId: CONVERSATION_ID,
    });
    expect(result.status).toBe('executed');
  });
});
