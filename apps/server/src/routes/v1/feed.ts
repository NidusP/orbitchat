import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { successResponse } from '../../lib/response';
import { zodValidationHook } from '../../lib/zod-hook';
import { authMiddleware } from '../../middleware/auth';
import { cursorQuerySchema } from '../../schemas/posts';
import { getHomeFeed } from '../../services/feed-service';

export const feedRouter = new Hono();

feedRouter.get(
  '/home',
  authMiddleware,
  zValidator('query', cursorQuerySchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const query = c.req.valid('query');
    const page = await getHomeFeed(auth.userId, query);
    return c.json(successResponse(page), 200);
  }
);
