process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { AppError } from '../lib/errors';
import * as chatHub from '../realtime/chat-hub';
import * as conversationLoaders from '../lib/conversation-loaders';
import * as conversationService from './conversation-service';
import * as userService from './user-service';
import {
  addGroupMembers,
  leaveGroup,
  removeGroupMember,
  transferGroupOwner,
  updateGroupMemberRole,
  updateGroupMetadata,
} from './group-member-service';

const GROUP_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID = '44444444-4444-4444-8444-444444444444';

const dbModule = await import('../db');

function membership(
  userId: string,
  role: 'owner' | 'admin' | 'member',
  id = `member-${userId}`
) {
  return {
    id,
    conversationId: GROUP_ID,
    userId,
    role,
    lastReadAt: null,
    joinedAt: new Date('2026-07-03T10:00:00.000Z'),
    leftAt: null,
  };
}

describe('group-member-service', () => {
  beforeEach(() => {
    mock.restore();

    spyOn(dbModule.db.query.conversations, 'findFirst').mockImplementation(
      () =>
        Promise.resolve({
          id: GROUP_ID,
          type: 'group',
          title: 'Weekend crew',
          announcement: null,
          createdByUserId: OWNER_ID,
          directKey: null,
          lastMessageAt: null,
          metadataVersion: 2,
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

    spyOn(conversationLoaders, 'loadGroupMembers').mockImplementation(async () => []);
    spyOn(userService, 'getUserById').mockImplementation(
      async (userId) =>
        ({
          id: userId,
          username: 'user',
          email: 'user@example.com',
          createdAt: new Date('2026-07-03T10:00:00.000Z'),
          updatedAt: new Date('2026-07-03T10:00:00.000Z'),
        }) as never
    );
    spyOn(chatHub, 'broadcastMemberJoined').mockImplementation(() => {});
    spyOn(chatHub, 'broadcastMemberLeft').mockImplementation(() => {});
    spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: () => Promise.resolve(),
        }) as never
    );
    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([]),
            }),
          }),
        }) as never
    );
    spyOn(dbModule.db, 'transaction').mockImplementation(
      async (callback) => callback(dbModule.db as never) as never
    );
  });

  test('leaveGroup rejects owner without transfer', async () => {
    await expect(leaveGroup(GROUP_ID, OWNER_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
    expect(chatHub.broadcastMemberLeft).not.toHaveBeenCalled();
  });

  test('removeGroupMember rejects admin removing another admin', async () => {
    await expect(removeGroupMember(GROUP_ID, ADMIN_ID, ADMIN_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('removeGroupMember rejects admin removing admin target', async () => {
    spyOn(conversationService, 'assertConversationMember').mockImplementation(
      async (_conversationId, userId) => {
        if (userId === ADMIN_ID) {
          return membership(ADMIN_ID, 'admin', 'admin-self');
        }
        if (userId === OWNER_ID) {
          return membership(OWNER_ID, 'owner', 'owner-target');
        }
        throw new AppError('FORBIDDEN', 'You are not a member of this conversation', 403);
      }
    );

    await expect(removeGroupMember(GROUP_ID, ADMIN_ID, OWNER_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'FORBIDDEN',
        statusCode: 403,
      })
    );
  });

  test('removeGroupMember broadcasts kicked event for owner removing member', async () => {
    await removeGroupMember(GROUP_ID, OWNER_ID, MEMBER_ID);

    expect(chatHub.broadcastMemberLeft).toHaveBeenCalledWith({
      conversationId: GROUP_ID,
      userId: MEMBER_ID,
      reason: 'kicked',
    });
  });

  test('addGroupMembers skips actor id and validates input', async () => {
    await expect(addGroupMembers(GROUP_ID, OWNER_ID, [])).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('transferGroupOwner rejects transferring to self', async () => {
    await expect(transferGroupOwner(GROUP_ID, OWNER_ID, OWNER_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('updateGroupMemberRole rejects non-owner actor', async () => {
    await expect(updateGroupMemberRole(GROUP_ID, ADMIN_ID, MEMBER_ID, 'admin')).rejects.toEqual(
      expect.objectContaining({
        code: 'FORBIDDEN',
        statusCode: 403,
      })
    );
  });

  test('updateGroupMetadata rejects unchanged fields', async () => {
    await expect(
      updateGroupMetadata(GROUP_ID, OWNER_ID, { title: 'Weekend crew', expectedVersion: 2 })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('updateGroupMetadata updates announcement alongside title version', async () => {
    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: () =>
                Promise.resolve([
                  {
                    id: GROUP_ID,
                    type: 'group',
                    title: 'Weekend crew',
                    announcement: 'Hike this Saturday',
                    metadataVersion: 3,
                  },
                ]),
            }),
          }),
        }) as never
    );
    const getDtoSpy = spyOn(conversationService, 'getConversationDto').mockImplementation(
      async () => ({}) as never
    );

    await updateGroupMetadata(GROUP_ID, OWNER_ID, {
      announcement: 'Hike this Saturday',
      expectedVersion: 2,
    });

    expect(getDtoSpy).toHaveBeenCalledWith(GROUP_ID, OWNER_ID);
  });

  test('updateGroupMetadata rejects stale expectedVersion', async () => {
    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([]),
            }),
          }),
        }) as never
    );

    await expect(
      updateGroupMetadata(GROUP_ID, OWNER_ID, { title: 'New title', expectedVersion: 1 })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'CONFLICT',
        statusCode: 409,
      })
    );
  });
});
