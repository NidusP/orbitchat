process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as conversationLoaders from '../lib/conversation-loaders';
import * as chatHub from '../realtime/chat-hub';
import * as conversationService from '../services/conversation-service';
import { handleTypingEvent, isTypingEvent } from './typing-service';

const CONVERSATION_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '11111111-1111-4111-8111-111111111111';

const dbModule = await import('../db');

describe('typing-service', () => {
  beforeEach(() => {
    mock.restore();
    spyOn(dbModule.db.query.conversations, 'findFirst').mockImplementation(
      () =>
        Promise.resolve({ id: CONVERSATION_ID, type: 'direct' }) as never
    );
    spyOn(conversationService, 'assertConversationMember').mockImplementation(async () => ({
      id: 'member-1',
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      role: null,
      lastReadAt: null,
      joinedAt: new Date('2026-07-03T10:00:00.000Z'),
      leftAt: null,
    }));
    spyOn(conversationLoaders, 'loadParticipantSummaries').mockImplementation(async () =>
      new Map([
        [
          USER_ID,
          {
            id: USER_ID,
            username: 'orbit',
            displayName: 'Orbit User',
            avatarUrl: null,
          },
        ],
      ])
    );
    spyOn(chatHub, 'broadcastTyping').mockImplementation(() => {});
  });

  test('isTypingEvent recognizes typing events', () => {
    expect(isTypingEvent('typing.started')).toBe(true);
    expect(isTypingEvent('typing.stopped')).toBe(true);
    expect(isTypingEvent('message.new')).toBe(false);
    expect(isTypingEvent('ping')).toBe(false);
  });

  test('handleTypingEvent broadcasts typing for direct chats', async () => {
    await handleTypingEvent(USER_ID, CONVERSATION_ID, 'typing.started');

    expect(chatHub.broadcastTyping).toHaveBeenCalledWith('typing.started', {
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      displayName: 'Orbit User',
    });
  });

  test('handleTypingEvent uses fallback display name when profile is missing', async () => {
    spyOn(conversationLoaders, 'loadParticipantSummaries').mockImplementation(async () => new Map());

    await handleTypingEvent(USER_ID, CONVERSATION_ID, 'typing.stopped');

    expect(chatHub.broadcastTyping).toHaveBeenCalledWith('typing.stopped', {
      conversationId: CONVERSATION_ID,
      userId: USER_ID,
      displayName: 'Someone',
    });
  });

  test('handleTypingEvent rejects group chats', async () => {
    spyOn(dbModule.db.query.conversations, 'findFirst').mockImplementation(
      () => Promise.resolve({ id: CONVERSATION_ID, type: 'group' }) as never
    );

    await expect(handleTypingEvent(USER_ID, CONVERSATION_ID, 'typing.started')).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
    expect(chatHub.broadcastTyping).not.toHaveBeenCalled();
  });

  test('handleTypingEvent rejects missing conversation', async () => {
    spyOn(dbModule.db.query.conversations, 'findFirst').mockImplementation(
      () => Promise.resolve(undefined) as never
    );

    await expect(handleTypingEvent(USER_ID, CONVERSATION_ID, 'typing.started')).rejects.toEqual(
      expect.objectContaining({
        code: 'NOT_FOUND',
        statusCode: 404,
      })
    );
  });
});
