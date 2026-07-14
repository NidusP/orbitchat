process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Message as MessageRow } from '../db/schema/messages';
import * as conversationLoaders from '../lib/conversation-loaders';
import { MESSAGE_EDIT_WINDOW_MS, MESSAGE_RECALL_WINDOW_MS } from '../lib/message-policy';
import * as chatHub from '../realtime/chat-hub';
import * as conversationService from './conversation-service';
import { createMessage, deleteMessage, updateMessage } from './message-service';
import * as uploadService from './upload-service';

const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const SENDER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const MESSAGE_ID = '44444444-4444-4444-8444-444444444444';
const UPLOAD_ID = '55555555-5555-4555-8555-555555555555';

const dbModule = await import('../db');

function sampleMessageRow(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: MESSAGE_ID,
    conversationId: CONVERSATION_ID,
    senderId: SENDER_ID,
    content: 'Hello Luna',
    createdAt: new Date(Date.now() - 60_000),
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('message-service edit/recall', () => {
  beforeEach(() => {
    mock.restore();

    spyOn(conversationService, 'assertConversationMember').mockImplementation(async () => ({
      id: 'member-1',
      conversationId: CONVERSATION_ID,
      userId: SENDER_ID,
      role: null,
      lastReadAt: null,
      joinedAt: new Date('2026-07-03T10:00:00.000Z'),
      leftAt: null,
    }));

    spyOn(conversationLoaders, 'loadParticipantSummaries').mockImplementation(async (userIds) =>
      new Map(
        userIds.map((userId) => [
          userId,
          {
            id: userId,
            username: userId === SENDER_ID ? 'orbit' : 'luna',
            displayName: userId === SENDER_ID ? 'Orbit User' : 'Luna User',
            avatarUrl: null,
          },
        ])
      )
    );

    spyOn(chatHub, 'broadcastMessageRecalled').mockImplementation(() => {});
  });

  test('updateMessage updates content and sets editedAt for sender', async () => {
    spyOn(dbModule.db.query.messages, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleMessageRow()) as never
    );

    spyOn(dbModule.db, 'transaction').mockImplementation(async (callback) =>
      callback({
        insert: () => ({
          values: () => Promise.resolve(),
        }),
        update: () => ({
          set: () => ({
            where: () => ({
              returning: () =>
                Promise.resolve([
                  sampleMessageRow({
                    content: 'Hello again',
                    editedAt: new Date('2026-07-03T10:05:00.000Z'),
                  }),
                ]),
            }),
          }),
        }),
      } as never)
    );

    const result = await updateMessage(CONVERSATION_ID, MESSAGE_ID, SENDER_ID, {
      content: 'Hello again',
    });

    expect(result.content).toBe('Hello again');
    expect(result.editedAt).toBe('2026-07-03T10:05:00.000Z');
  });

  test('updateMessage rejects edits outside the edit window', async () => {
    spyOn(dbModule.db.query.messages, 'findFirst').mockImplementation(
      () =>
        Promise.resolve(
          sampleMessageRow({
            createdAt: new Date(Date.now() - MESSAGE_EDIT_WINDOW_MS - 1_000),
          })
        ) as never
    );

    await expect(
      updateMessage(CONVERSATION_ID, MESSAGE_ID, SENDER_ID, { content: 'Too late' })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('updateMessage rejects unchanged content', async () => {
    spyOn(dbModule.db.query.messages, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleMessageRow({ content: 'Hello Luna' })) as never
    );

    await expect(
      updateMessage(CONVERSATION_ID, MESSAGE_ID, SENDER_ID, { content: 'Hello Luna' })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('updateMessage rejects recalled messages', async () => {
    spyOn(dbModule.db.query.messages, 'findFirst').mockImplementation(
      () =>
        Promise.resolve(
          sampleMessageRow({ deletedAt: new Date('2026-07-03T10:04:00.000Z') })
        ) as never
    );

    await expect(
      updateMessage(CONVERSATION_ID, MESSAGE_ID, SENDER_ID, { content: 'Hello again' })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('deleteMessage rejects already recalled messages', async () => {
    spyOn(dbModule.db.query.messages, 'findFirst').mockImplementation(
      () =>
        Promise.resolve(
          sampleMessageRow({ deletedAt: new Date('2026-07-03T10:04:00.000Z') })
        ) as never
    );

    await expect(deleteMessage(CONVERSATION_ID, MESSAGE_ID, SENDER_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
    expect(chatHub.broadcastMessageRecalled).not.toHaveBeenCalled();
  });

  test('updateMessage rejects non-sender', async () => {
    spyOn(dbModule.db.query.messages, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleMessageRow()) as never
    );

    await expect(
      updateMessage(CONVERSATION_ID, MESSAGE_ID, OTHER_USER_ID, { content: 'Hacked' })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'FORBIDDEN',
        statusCode: 403,
      })
    );
  });

  test('deleteMessage recalls within window and broadcasts recall event', async () => {
    spyOn(dbModule.db.query.messages, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleMessageRow()) as never
    );

    const recalledAt = new Date('2026-07-03T10:06:00.000Z');
    spyOn(dbModule.db, 'transaction').mockImplementation(async (callback) =>
      callback({
        update: () => ({
          set: () => ({
            where: () => ({
              returning: () =>
                Promise.resolve([
                  sampleMessageRow({
                    deletedAt: recalledAt,
                  }),
                ]),
            }),
          }),
        }),
        insert: () => ({
          values: () => ({
            returning: () =>
              Promise.resolve([
                {
                  id: '77777777-7777-4777-8777-777777777777',
                  conversationId: CONVERSATION_ID,
                  messageId: MESSAGE_ID,
                  recalledByUserId: SENDER_ID,
                  messageCreatedAt: sampleMessageRow().createdAt,
                  recalledAt,
                },
              ]),
          }),
        }),
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
        }),
      } as never)
    );

    const result = await deleteMessage(CONVERSATION_ID, MESSAGE_ID, SENDER_ID);
    expect(result).toEqual({ ok: true });
    expect(chatHub.broadcastMessageRecalled).toHaveBeenCalled();
  });

  test('deleteMessage rejects recalls outside the recall window', async () => {
    spyOn(dbModule.db.query.messages, 'findFirst').mockImplementation(
      () =>
        Promise.resolve(
          sampleMessageRow({
            createdAt: new Date(Date.now() - MESSAGE_RECALL_WINDOW_MS - 1_000),
          })
        ) as never
    );

    await expect(deleteMessage(CONVERSATION_ID, MESSAGE_ID, SENDER_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
    expect(chatHub.broadcastMessageRecalled).not.toHaveBeenCalled();
  });

  test('deleteMessage rejects non-sender', async () => {
    spyOn(dbModule.db.query.messages, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleMessageRow()) as never
    );

    await expect(deleteMessage(CONVERSATION_ID, MESSAGE_ID, OTHER_USER_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'FORBIDDEN',
        statusCode: 403,
      })
    );
  });
});

describe('message-service createMessage', () => {
  beforeEach(() => {
    mock.restore();

    spyOn(conversationService, 'assertConversationMember').mockImplementation(async () => ({
      id: 'member-1',
      conversationId: CONVERSATION_ID,
      userId: SENDER_ID,
      role: null,
      lastReadAt: null,
      joinedAt: new Date('2026-07-03T10:00:00.000Z'),
      leftAt: null,
    }));

    spyOn(conversationLoaders, 'loadParticipantSummaries').mockImplementation(async (userIds) =>
      new Map(
        userIds.map((userId) => [
          userId,
          {
            id: userId,
            username: userId === SENDER_ID ? 'orbit' : 'luna',
            displayName: userId === SENDER_ID ? 'Orbit User' : 'Luna User',
            avatarUrl: null,
          },
        ])
      )
    );

    spyOn(chatHub, 'broadcastMessageNew').mockImplementation(() => {});
  });

  test('createMessage links uploadId and returns media', async () => {
    const media = [
      {
        id: '66666666-6666-4666-8666-666666666666',
        uploadId: UPLOAD_ID,
        url: `/api/v1/media/${UPLOAD_ID}`,
        mimeType: 'image/png',
        sizeBytes: 1024,
        sortOrder: 0,
      },
    ];

    spyOn(uploadService, 'linkMessageMedia').mockImplementation(async () => media);

    spyOn(dbModule.db, 'transaction').mockImplementation(async (callback) =>
      callback({
        insert: () => ({
          values: () => ({
            returning: () =>
              Promise.resolve([
                sampleMessageRow({
                  content: '',
                }),
              ]),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => Promise.resolve(),
          }),
        }),
      } as never)
    );

    const result = await createMessage(CONVERSATION_ID, SENDER_ID, { uploadId: UPLOAD_ID });

    expect(uploadService.linkMessageMedia).toHaveBeenCalledWith(
      MESSAGE_ID,
      SENDER_ID,
      UPLOAD_ID
    );
    expect(result.media).toEqual(media);
    expect(chatHub.broadcastMessageNew).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: CONVERSATION_ID,
        message: expect.objectContaining({ media }),
      })
    );
  });

  test('createMessage sends text without calling linkMessageMedia', async () => {
    const linkSpy = spyOn(uploadService, 'linkMessageMedia');

    spyOn(dbModule.db, 'transaction').mockImplementation(async (callback) =>
      callback({
        insert: () => ({
          values: () => ({
            returning: () =>
              Promise.resolve([
                sampleMessageRow({
                  content: 'Hello with text only',
                }),
              ]),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => Promise.resolve(),
          }),
        }),
      } as never)
    );

    const result = await createMessage(CONVERSATION_ID, SENDER_ID, {
      content: 'Hello with text only',
    });

    expect(linkSpy).not.toHaveBeenCalled();
    expect(result.content).toBe('Hello with text only');
    expect(result.media).toBeUndefined();
  });
});
