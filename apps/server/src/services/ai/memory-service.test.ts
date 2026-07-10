process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { UserAgentMemory as UserAgentMemoryRow } from '../../db/schema/user-agent-memories';
import { AppError } from '../../lib/errors';
import {
  createMemory,
  listMemoriesForUser,
  softDeleteMemory,
} from './memory-service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const MEMORY_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_MEMORY_ID = '44444444-4444-4444-8444-444444444444';

const dbModule = await import('../../db');

function sampleMemoryRow(overrides: Partial<UserAgentMemoryRow> = {}): UserAgentMemoryRow {
  return {
    id: MEMORY_ID,
    userId: USER_ID,
    agentId: null,
    kind: 'preference',
    content: 'Prefer brief replies',
    source: 'user_explicit',
    conversationId: null,
    createdAt: new Date('2026-07-09T10:00:00.000Z'),
    updatedAt: new Date('2026-07-09T10:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('memory-service', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('createMemory and listMemoriesForUser return newest memories first', async () => {
    const older = sampleMemoryRow({
      id: OTHER_MEMORY_ID,
      content: 'Call me Orbit',
      kind: 'nickname',
      createdAt: new Date('2026-07-08T10:00:00.000Z'),
      updatedAt: new Date('2026-07-08T10:00:00.000Z'),
    });
    const newer = sampleMemoryRow();

    spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: () => ({
            returning: () => Promise.resolve([newer]),
          }),
        }) as never
    );

    const created = await createMemory(USER_ID, {
      kind: 'preference',
      content: 'Prefer brief replies',
    });

    expect(created.id).toBe(MEMORY_ID);
    expect(created.source).toBe('user_explicit');
    expect(created.deletedAt).toBeNull();

    spyOn(dbModule.db, 'select').mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([newer, older]),
              }),
            }),
          }),
        }) as never
    );

    const listed = await listMemoriesForUser(USER_ID);
    expect(listed).toHaveLength(2);
    expect(listed[0]?.id).toBe(MEMORY_ID);
    expect(listed[1]?.id).toBe(OTHER_MEMORY_ID);
  });

  test('softDeleteMemory removes memory from list results', async () => {
    spyOn(dbModule.db.query.userAgentMemories, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleMemoryRow()) as never
    );

    const updateWhere = mock(() => Promise.resolve());
    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: updateWhere,
          }),
        }) as never
    );

    await softDeleteMemory(MEMORY_ID, USER_ID);
    expect(updateWhere).toHaveBeenCalled();

    spyOn(dbModule.db, 'select').mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        }) as never
    );

    const listed = await listMemoriesForUser(USER_ID);
    expect(listed).toEqual([]);
  });

  test('softDeleteMemory rejects other user memory with 404', async () => {
    spyOn(dbModule.db.query.userAgentMemories, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleMemoryRow({ userId: OTHER_USER_ID })) as never
    );

    await expect(softDeleteMemory(MEMORY_ID, USER_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    } satisfies Partial<AppError>);
  });

  test('softDeleteMemory rejects already deleted memory with 404', async () => {
    spyOn(dbModule.db.query.userAgentMemories, 'findFirst').mockImplementation(
      () =>
        Promise.resolve(
          sampleMemoryRow({ deletedAt: new Date('2026-07-09T11:00:00.000Z') })
        ) as never
    );

    await expect(softDeleteMemory(MEMORY_ID, USER_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    } satisfies Partial<AppError>);
  });

  test('listMemoriesForUser returns empty list when table is missing', async () => {
    spyOn(dbModule.db, 'select').mockImplementation(() => {
      throw { code: '42P01' };
    });

    const listed = await listMemoriesForUser(USER_ID);
    expect(listed).toEqual([]);
  });
});
