import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { AppError } from '../../lib/errors';
import { successResponse } from '../../lib/response';
import { parseUuidParam } from '../../lib/validation';
import { zodValidationHook } from '../../lib/zod-hook';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth';
import { cursorQuerySchema, userSearchQuerySchema } from '../../schemas/posts';
import {
  updateProfileSchema,
  updateUserSchema,
} from '../../schemas/users';
import { getUserPosts } from '../../services/feed-service';
import {
  followUser,
  getFollowers,
  getFollowing,
  searchUsers,
  unfollowUser,
} from '../../services/follow-service';
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

function viewerId(c: { get: (key: 'auth') => { userId: string } | undefined }): string | null {
  return c.get('auth')?.userId ?? null;
}

usersRouter.get(
  '/search',
  zValidator('query', userSearchQuerySchema, zodValidationHook),
  async (c) => {
    const query = c.req.valid('query');
    const page = await searchUsers(query.q, query);
    return c.json(successResponse(page), 200);
  }
);

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

usersRouter.get(
  '/:id/posts',
  optionalAuthMiddleware,
  zValidator('query', cursorQuerySchema, zodValidationHook),
  async (c) => {
    const userId = parseUserId(c.req.param('id'));
    const query = c.req.valid('query');
    const page = await getUserPosts(userId, viewerId(c), query);
    return c.json(successResponse(page), 200);
  }
);

usersRouter.post('/:id/follow', authMiddleware, async (c) => {
  const followeeId = parseUserId(c.req.param('id'));
  const auth = c.get('auth');
  const result = await followUser(auth.userId, followeeId);
  return c.json(successResponse(result), 200);
});

usersRouter.delete('/:id/follow', authMiddleware, async (c) => {
  const followeeId = parseUserId(c.req.param('id'));
  const auth = c.get('auth');
  const result = await unfollowUser(auth.userId, followeeId);
  return c.json(successResponse(result), 200);
});

usersRouter.get(
  '/:id/followers',
  zValidator('query', cursorQuerySchema, zodValidationHook),
  async (c) => {
    const userId = parseUserId(c.req.param('id'));
    const query = c.req.valid('query');
    const page = await getFollowers(userId, query);
    return c.json(successResponse(page), 200);
  }
);

usersRouter.get(
  '/:id/following',
  zValidator('query', cursorQuerySchema, zodValidationHook),
  async (c) => {
    const userId = parseUserId(c.req.param('id'));
    const query = c.req.valid('query');
    const page = await getFollowing(userId, query);
    return c.json(successResponse(page), 200);
  }
);

usersRouter.patch('/:id', authMiddleware, zValidator('json', updateUserSchema, zodValidationHook), async (c) => {
  const userId = parseUserId(c.req.param('id'));
  const auth = c.get('auth');
  assertSelf(auth.userId, userId);

  const input = c.req.valid('json');
  const user = await updateUser(userId, input);
  return c.json(successResponse(user), 200);
});
