process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { AppError } from '../lib/errors';
import * as conversationLoaders from '../lib/conversation-loaders';
import * as conversationService from './conversation-service';
import {
  acceptGroupInvite,
  createGroupInvite,
  getInvitePreview,
  listGroupInvites,
  revokeGroupInvite,
} from './group-invite-service';

const GROUP_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID = '44444444-4444-4444-8444-444444444444';
const INVITE_ID = '66666666-6666-4666-8666-666666666666';
const INVITE_CODE = 'abc123def456';

const dbModule = await import('../db');

function membership(userId: string, role: 'owner' | 'admin' | 'member') {
  return {
    id: `member-${userId}`,
    conversationId: GROUP_ID,
    userId,
    role,
    lastReadAt: null,
    joinedAt: new Date('2026-07-03T10:00:00.000Z'),
    leftAt: null,
  };
}

function sampleInviteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: INVITE_ID,
    conversationId: GROUP_ID,
    code: INVITE_CODE,
    createdByUserId: OWNER_ID,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxUses: null,
    useCount: 0,
    revokedAt: null,
    createdAt: new Date('2026-07-07T10:00:00.000Z'),
    updatedAt: new Date('2026-07-07T10:00:00.000Z'),
    ...overrides,
  };
}

describe('group-invite-service', () => {
  beforeEach(() => {
    mock.restore();

    spyOn(dbModule.db.query.conversations, 'findFirst').mockImplementation(
      () =>
        Promise.resolve({
          id: GROUP_ID,
          type: 'group',
          title: 'Weekend crew',
          createdByUserId: OWNER_ID,
          directKey: null,
          lastMessageAt: null,
          createdAt: new Date('2026-07-03T10:00:00.000Z'),
          updatedAt: new Date('2026-07-03T10:00:00.000Z'),
        }) as never
    );

    spyOn(conversationService, 'assertConversationMember').mockImplementation(
      async (_conversationId, userId) => {
        if (userId === OWNER_ID) {
          return membership(OWNER_ID, 'owner');
        }
        if (userId === ADMIN_ID) {
          return membership(ADMIN_ID, 'admin');
        }
        if (userId === MEMBER_ID) {
          return membership(MEMBER_ID, 'member');
        }
        throw new AppError('FORBIDDEN', 'You are not a member of this conversation', 403);
      }
    );

    spyOn(conversationLoaders, 'loadGroupMembers').mockImplementation(async () => [
      {
        id: OWNER_ID,
        username: 'owner',
        displayName: 'Owner User',
        avatarUrl: null,
        role: 'owner',
        joinedAt: '2026-07-03T10:00:00.000Z',
      },
    ]);
  });

  test('createGroupInvite allows owner to create invite', async () => {
    spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: () => ({
            onConflictDoNothing: () => ({
              returning: () => Promise.resolve([sampleInviteRow()]),
            }),
          }),
        }) as never
    );

    const invite = await createGroupInvite(GROUP_ID, OWNER_ID, {});
    expect(invite.code).toBe(INVITE_CODE);
    expect(invite.conversationId).toBe(GROUP_ID);
  });

  test('createGroupInvite rejects regular members', async () => {
    await expect(createGroupInvite(GROUP_ID, MEMBER_ID, {})).rejects.toEqual(
      expect.objectContaining({
        code: 'FORBIDDEN',
        statusCode: 403,
      })
    );
  });

  test('listGroupInvites returns invites for admin', async () => {
    spyOn(dbModule.db.query.groupInvites, 'findMany').mockImplementation(
      () => Promise.resolve([sampleInviteRow()]) as never
    );

    const invites = await listGroupInvites(GROUP_ID, ADMIN_ID);
    expect(invites).toHaveLength(1);
    expect(invites[0]?.code).toBe(INVITE_CODE);
  });

  test('revokeGroupInvite marks invite as revoked', async () => {
    spyOn(dbModule.db.query.groupInvites, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleInviteRow()) as never
    );

    const revokedAt = new Date('2026-07-07T12:00:00.000Z');
    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: () =>
                Promise.resolve([
                  sampleInviteRow({
                    revokedAt,
                    updatedAt: revokedAt,
                  }),
                ]),
            }),
          }),
        }) as never
    );

    const invite = await revokeGroupInvite(INVITE_CODE, OWNER_ID);
    expect(invite.revokedAt).toBe(revokedAt.toISOString());
  });

  test('revokeGroupInvite rejects already revoked invite', async () => {
    spyOn(dbModule.db.query.groupInvites, 'findFirst').mockImplementation(
      () =>
        Promise.resolve(
          sampleInviteRow({ revokedAt: new Date('2026-07-07T11:00:00.000Z') })
        ) as never
    );

    await expect(revokeGroupInvite(INVITE_CODE, OWNER_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('getInvitePreview reports active invite', async () => {
    spyOn(dbModule.db.query.groupInvites, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleInviteRow()) as never
    );

    const preview = await getInvitePreview(INVITE_CODE, MEMBER_ID);
    expect(preview.groupTitle).toBe('Weekend crew');
    expect(preview.memberCount).toBe(1);
    expect(preview.isActive).toBe(true);
  });

  test('getInvitePreview reports inactive revoked invite', async () => {
    spyOn(dbModule.db.query.groupInvites, 'findFirst').mockImplementation(
      () =>
        Promise.resolve(
          sampleInviteRow({ revokedAt: new Date('2026-07-07T11:00:00.000Z') })
        ) as never
    );

    const preview = await getInvitePreview(INVITE_CODE, MEMBER_ID);
    expect(preview.isActive).toBe(false);
  });

  test('acceptGroupInvite adds new member and increments use count', async () => {
    spyOn(dbModule.db.query.groupInvites, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleInviteRow()) as never
    );
    spyOn(dbModule.db.query.conversationMembers, 'findFirst').mockImplementation(
      () => Promise.resolve(undefined) as never
    );

    const updateSpy = spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([sampleInviteRow({ useCount: 1 })]),
            }),
          }),
        }) as never
    );
    spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: () => Promise.resolve(),
        }) as never
    );
    spyOn(dbModule.db, 'transaction').mockImplementation(
      async (callback) => callback(dbModule.db as never) as never
    );

    const result = await acceptGroupInvite(INVITE_CODE, MEMBER_ID);
    expect(result).toEqual({ ok: true });
    expect(updateSpy).toHaveBeenCalled();
  });

  test('acceptGroupInvite rejects expired invite', async () => {
    spyOn(dbModule.db.query.groupInvites, 'findFirst').mockImplementation(
      () =>
        Promise.resolve(
          sampleInviteRow({ expiresAt: new Date('2020-01-01T00:00:00.000Z') })
        ) as never
    );

    await expect(acceptGroupInvite(INVITE_CODE, MEMBER_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('acceptGroupInvite is idempotent for existing members', async () => {
    spyOn(dbModule.db.query.groupInvites, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleInviteRow()) as never
    );
    spyOn(dbModule.db.query.conversationMembers, 'findFirst').mockImplementation(
      () =>
        Promise.resolve({
          id: 'member-existing',
          conversationId: GROUP_ID,
          userId: MEMBER_ID,
          role: 'member',
          lastReadAt: null,
          joinedAt: new Date('2026-07-03T10:00:00.000Z'),
          leftAt: null,
        }) as never
    );

    const result = await acceptGroupInvite(INVITE_CODE, MEMBER_ID);
    expect(result).toEqual({ ok: true });
  });
});
