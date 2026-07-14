process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { PostAuthorSummary } from '@orbitchat/shared-types';
import type { Notification } from '../db/schema/notifications';
import { encodeTimelineCursor } from '../lib/cursor';
import {
  createMessageReceivedNotification,
  createPostCommentedNotification,
  createPostLikedNotification,
  getUnreadNotificationCount,
  listNotifications,
  markNotificationsRead,
} from './notification-service';

const dbModule = await import('../db');
const socialLoaders = await import('../lib/social-loaders');

const RECIPIENT_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const POST_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COMMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CONVERSATION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const MESSAGE_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const NOTIFICATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOTIFICATION_ID_2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const actorSummary: PostAuthorSummary = {
  id: ACTOR_ID,
  username: 'luna',
  displayName: 'Luna User',
  avatarUrl: null,
};

function sampleNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: NOTIFICATION_ID,
    recipientId: RECIPIENT_ID,
    actorId: ACTOR_ID,
    type: 'post_liked',
    postId: POST_ID,
    commentId: null,
    conversationId: null,
    messageId: null,
    readAt: null,
    createdAt: new Date('2026-07-13T01:00:00.000Z'),
    ...overrides,
  };
}

function mockAuthorLoaders(): void {
  spyOn(socialLoaders, 'loadAuthorSummaries').mockImplementation(
    async (userIds) => {
      const map = new Map<string, PostAuthorSummary>();
      for (const userId of userIds) {
        if (userId === ACTOR_ID) {
          map.set(userId, actorSummary);
        }
      }
      return map;
    }
  );
}

function mockNotificationListRows(
  rows: Array<{
    notification: Notification;
    postContent: string | null;
    commentContent: string | null;
    messageContent: string | null;
  }>
) {
  spyOn(dbModule.db, 'select').mockImplementation(
    () =>
      ({
        from: () => ({
          leftJoin: () => ({
            leftJoin: () => ({
              leftJoin: () => ({
                where: () => ({
                  orderBy: () => ({
                    limit: async () => rows,
                  }),
                }),
              }),
            }),
          }),
        }),
      }) as never
  );
}

function mockUnreadCount(value: number) {
  spyOn(dbModule.db, 'select').mockImplementation(
    () =>
      ({
        from: () => ({
          leftJoin: () => ({
            leftJoin: () => ({
              leftJoin: () => ({
                where: async () => [{ value }],
              }),
            }),
          }),
        }),
      }) as never
  );
}

describe('notification-service create', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('createPostLikedNotification skips self-like', async () => {
    const insertSpy = spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: mock(() => Promise.resolve()),
        }) as never
    );

    await createPostLikedNotification(POST_ID, RECIPIENT_ID, RECIPIENT_ID);

    expect(insertSpy).not.toHaveBeenCalled();
  });

  test('createPostLikedNotification inserts for other user', async () => {
    const valuesMock = mock(() => Promise.resolve());
    spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: valuesMock,
        }) as never
    );

    await createPostLikedNotification(POST_ID, ACTOR_ID, RECIPIENT_ID);

    expect(valuesMock).toHaveBeenCalledWith({
      recipientId: RECIPIENT_ID,
      actorId: ACTOR_ID,
      type: 'post_liked',
      postId: POST_ID,
    });
  });

  test('createPostCommentedNotification skips self-comment', async () => {
    const insertSpy = spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: mock(() => Promise.resolve()),
        }) as never
    );

    await createPostCommentedNotification(POST_ID, COMMENT_ID, RECIPIENT_ID, RECIPIENT_ID);

    expect(insertSpy).not.toHaveBeenCalled();
  });

  test('createPostCommentedNotification inserts for other user', async () => {
    const valuesMock = mock(() => Promise.resolve());
    spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: valuesMock,
        }) as never
    );

    await createPostCommentedNotification(POST_ID, COMMENT_ID, ACTOR_ID, RECIPIENT_ID);

    expect(valuesMock).toHaveBeenCalledWith({
      recipientId: RECIPIENT_ID,
      actorId: ACTOR_ID,
      type: 'post_commented',
      postId: POST_ID,
      commentId: COMMENT_ID,
    });
  });

  test('createMessageReceivedNotification skips self-message', async () => {
    const insertSpy = spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: mock(() => Promise.resolve()),
        }) as never
    );

    await createMessageReceivedNotification(
      CONVERSATION_ID,
      MESSAGE_ID,
      RECIPIENT_ID,
      RECIPIENT_ID
    );

    expect(insertSpy).not.toHaveBeenCalled();
  });

  test('createMessageReceivedNotification inserts for other user', async () => {
    const valuesMock = mock(() => Promise.resolve());
    spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: valuesMock,
        }) as never
    );

    await createMessageReceivedNotification(
      CONVERSATION_ID,
      MESSAGE_ID,
      ACTOR_ID,
      RECIPIENT_ID
    );

    expect(valuesMock).toHaveBeenCalledWith({
      recipientId: RECIPIENT_ID,
      actorId: ACTOR_ID,
      type: 'message_received',
      conversationId: CONVERSATION_ID,
      messageId: MESSAGE_ID,
    });
  });
});

describe('notification-service list', () => {
  beforeEach(() => {
    mock.restore();
    mockAuthorLoaders();
  });

  test('listNotifications maps rows to interaction notifications', async () => {
    mockNotificationListRows([
      {
        notification: sampleNotification(),
        postContent: 'Hello world',
        commentContent: null,
        messageContent: null,
      },
    ]);

    const page = await listNotifications(RECIPIENT_ID, { limit: 10 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toEqual({
      id: NOTIFICATION_ID,
      type: 'post_liked',
      actor: actorSummary,
      post: {
        id: POST_ID,
        contentPreview: 'Hello world',
      },
      readAt: null,
      createdAt: '2026-07-13T01:00:00.000Z',
    });
    expect(page.nextCursor).toBeNull();
  });

  test('listNotifications returns nextCursor when more rows than limit', async () => {
    const older = sampleNotification({
      id: NOTIFICATION_ID_2,
      createdAt: new Date('2026-07-12T01:00:00.000Z'),
    });

    mockNotificationListRows([
      {
        notification: sampleNotification(),
        postContent: 'Newer post',
        commentContent: null,
        messageContent: null,
      },
      {
        notification: older,
        postContent: 'Older post',
        commentContent: null,
        messageContent: null,
      },
    ]);

    const page = await listNotifications(RECIPIENT_ID, { limit: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(NOTIFICATION_ID);
    expect(page.nextCursor).toBe(
      encodeTimelineCursor(new Date('2026-07-13T01:00:00.000Z'), NOTIFICATION_ID)
    );
  });

  test('listNotifications includes comment preview for post_commented', async () => {
    mockNotificationListRows([
      {
        notification: sampleNotification({
          type: 'post_commented',
          commentId: COMMENT_ID,
        }),
        postContent: 'Original post',
        commentContent: 'Nice post!',
        messageContent: null,
      },
    ]);

    const page = await listNotifications(RECIPIENT_ID, { limit: 10 });

    expect(page.items[0]?.type).toBe('post_commented');
    expect(page.items[0]?.comment).toEqual({
      id: COMMENT_ID,
      contentPreview: 'Nice post!',
    });
  });

  test('listNotifications maps message_received with conversation and preview', async () => {
    mockNotificationListRows([
      {
        notification: sampleNotification({
          type: 'message_received',
          postId: null,
          conversationId: CONVERSATION_ID,
          messageId: MESSAGE_ID,
        }),
        postContent: null,
        commentContent: null,
        messageContent: 'Hey there!',
      },
    ]);

    const page = await listNotifications(RECIPIENT_ID, { limit: 10 });

    expect(page.items[0]).toEqual({
      id: NOTIFICATION_ID,
      type: 'message_received',
      actor: actorSummary,
      conversationId: CONVERSATION_ID,
      message: {
        id: MESSAGE_ID,
        contentPreview: 'Hey there!',
      },
      readAt: null,
      createdAt: '2026-07-13T01:00:00.000Z',
    });
  });
});

describe('notification-service read state', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('markNotificationsRead marks specific notifications and returns count', async () => {
    const returningMock = mock(async () => [
      { id: NOTIFICATION_ID },
      { id: NOTIFICATION_ID_2 },
    ]);
    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: returningMock,
            }),
          }),
        }) as never
    );

    const updated = await markNotificationsRead(RECIPIENT_ID, {
      notificationIds: [NOTIFICATION_ID, NOTIFICATION_ID_2],
    });

    expect(updated).toBe(2);
    expect(returningMock).toHaveBeenCalled();
  });

  test('markNotificationsRead marks all unread when notificationIds omitted', async () => {
    const returningMock = mock(async () => [{ id: NOTIFICATION_ID }]);
    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: returningMock,
            }),
          }),
        }) as never
    );

    const updated = await markNotificationsRead(RECIPIENT_ID, {});

    expect(updated).toBe(1);
    expect(returningMock).toHaveBeenCalled();
  });

  test('getUnreadNotificationCount returns unread total', async () => {
    mockUnreadCount(5);

    const count = await getUnreadNotificationCount(RECIPIENT_ID);

    expect(count).toBe(5);
  });

  test('getUnreadNotificationCount returns zero when no unread rows', async () => {
    mockUnreadCount(0);

    const count = await getUnreadNotificationCount(RECIPIENT_ID);

    expect(count).toBe(0);
  });
});
