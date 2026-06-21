import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { AppError } from '../../lib/errors';
import { successResponse } from '../../lib/response';
import { parseUuidParam } from '../../lib/validation';
import { zodValidationHook } from '../../lib/zod-hook';
import { authMiddleware } from '../../middleware/auth';
import {
  updateProfileSchema,
  updateUserSchema,
} from '../../schemas/users';
import {
  getProfileByUserId,
  getUserById,
  updateProfile,
  updateUser,
} from '../../services/user-service';

export const usersRouter = new Hono();

function parseUserId(rawId: string): string {
  return parseUuidParam(rawId, 'id', 'Invalid user id');
}

function assertSelf(actorUserId: string, targetUserId: string): void {
  if (actorUserId !== targetUserId) {
    throw new AppError('FORBIDDEN', 'You can only modify your own account', 403);
  }
}

usersRouter.get('/:id/profile', async (c) => {
  const userId = parseUserId(c.req.param('id'));
  const profile = await getProfileByUserId(userId);
  return c.json(successResponse(profile), 200);
});

usersRouter.patch(
  '/:id/profile',
  authMiddleware,
  zValidator('json', updateProfileSchema, zodValidationHook),
  async (c) => {
    const userId = parseUserId(c.req.param('id'));
    const auth = c.get('auth');
    assertSelf(auth.userId, userId);

    const input = c.req.valid('json');
    const profile = await updateProfile(userId, input);
    return c.json(successResponse(profile), 200);
  }
);

usersRouter.get('/:id', async (c) => {
  const userId = parseUserId(c.req.param('id'));
  const user = await getUserById(userId);
  return c.json(successResponse(user), 200);
});

usersRouter.patch('/:id', authMiddleware, zValidator('json', updateUserSchema, zodValidationHook), async (c) => {
  const userId = parseUserId(c.req.param('id'));
  const auth = c.get('auth');
  assertSelf(auth.userId, userId);

  const input = c.req.valid('json');
  const user = await updateUser(userId, input);
  return c.json(successResponse(user), 200);
});
