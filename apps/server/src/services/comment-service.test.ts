process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { deleteComment } from './comment-service';

const POST_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_POST_ID = '66666666-6666-4666-8666-666666666666';
const COMMENT_ID = '77777777-7777-4777-8777-777777777777';
const AUTHOR_ID = '11111111-1111-4111-8111-111111111111';

const dbModule = await import('../db');

describe('comment-service robustness', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('deleteComment rejects mismatched postId in path', async () => {
    spyOn(dbModule.db.query.comments, 'findFirst').mockImplementation(
      () =>
        Promise.resolve({
          id: COMMENT_ID,
          postId: OTHER_POST_ID,
          authorId: AUTHOR_ID,
          content: 'Nice',
          createdAt: new Date('2026-07-03T10:00:00.000Z'),
          updatedAt: new Date('2026-07-03T10:00:00.000Z'),
          deletedAt: null,
        }) as never
    );

    await expect(deleteComment(POST_ID, COMMENT_ID, AUTHOR_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'NOT_FOUND',
        statusCode: 404,
      })
    );
  });

  test('deleteComment rejects already deleted comment', async () => {
    spyOn(dbModule.db.query.comments, 'findFirst').mockImplementation(
      () =>
        Promise.resolve({
          id: COMMENT_ID,
          postId: POST_ID,
          authorId: AUTHOR_ID,
          content: 'Nice',
          createdAt: new Date('2026-07-03T10:00:00.000Z'),
          updatedAt: new Date('2026-07-03T10:00:00.000Z'),
          deletedAt: new Date('2026-07-03T10:05:00.000Z'),
        }) as never
    );

    await expect(deleteComment(POST_ID, COMMENT_ID, AUTHOR_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });
});
