import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { successResponse } from '../../lib/response';
import { parseUuidParam } from '../../lib/validation';
import { zodValidationHook } from '../../lib/zod-hook';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth';
import {
  createCommentSchema,
  createPostSchema,
  cursorQuerySchema,
  updatePostSchema,
} from '../../schemas/posts';
import {
  createComment,
  deleteComment,
  listPostComments,
} from '../../services/comment-service';
import {
  createPost,
  deletePost,
  getPostById,
  likePost,
  unlikePost,
  updatePost,
} from '../../services/post-service';

export const postsRouter = new Hono();

function parsePostId(rawId: string): string {
  return parseUuidParam(rawId, 'id', 'Invalid post id');
}

function parseCommentId(rawId: string): string {
  return parseUuidParam(rawId, 'commentId', 'Invalid comment id');
}

function viewerId(c: { get: (key: 'auth') => { userId: string } | undefined }): string | null {
  return c.get('auth')?.userId ?? null;
}

postsRouter.post(
  '/',
  authMiddleware,
  zValidator('json', createPostSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const input = c.req.valid('json');
    const post = await createPost(auth.userId, input);
    return c.json(successResponse(post), 201);
  }
);

postsRouter.get('/:id', optionalAuthMiddleware, async (c) => {
  const postId = parsePostId(c.req.param('id'));
  const post = await getPostById(postId, viewerId(c));
  return c.json(successResponse(post), 200);
});

postsRouter.patch(
  '/:id',
  authMiddleware,
  zValidator('json', updatePostSchema, zodValidationHook),
  async (c) => {
    const postId = parsePostId(c.req.param('id'));
    const auth = c.get('auth');
    const input = c.req.valid('json');
    const post = await updatePost(postId, auth.userId, input);
    return c.json(successResponse(post), 200);
  }
);

postsRouter.delete('/:id', authMiddleware, async (c) => {
  const postId = parsePostId(c.req.param('id'));
  const auth = c.get('auth');
  await deletePost(postId, auth.userId);
  return c.json(successResponse({ deleted: true }), 200);
});

postsRouter.post('/:id/like', authMiddleware, async (c) => {
  const postId = parsePostId(c.req.param('id'));
  const auth = c.get('auth');
  const result = await likePost(postId, auth.userId);
  return c.json(successResponse(result), 200);
});

postsRouter.delete('/:id/like', authMiddleware, async (c) => {
  const postId = parsePostId(c.req.param('id'));
  const auth = c.get('auth');
  const result = await unlikePost(postId, auth.userId);
  return c.json(successResponse(result), 200);
});

postsRouter.get(
  '/:id/comments',
  zValidator('query', cursorQuerySchema, zodValidationHook),
  async (c) => {
    const postId = parsePostId(c.req.param('id'));
    const query = c.req.valid('query');
    const page = await listPostComments(postId, query);
    return c.json(successResponse(page), 200);
  }
);

postsRouter.post(
  '/:id/comments',
  authMiddleware,
  zValidator('json', createCommentSchema, zodValidationHook),
  async (c) => {
    const postId = parsePostId(c.req.param('id'));
    const auth = c.get('auth');
    const input = c.req.valid('json');
    const comment = await createComment(postId, auth.userId, input);
    return c.json(successResponse(comment), 201);
  }
);

postsRouter.delete('/:id/comments/:commentId', authMiddleware, async (c) => {
  const postId = parsePostId(c.req.param('id'));
  const commentId = parseCommentId(c.req.param('commentId'));
  const auth = c.get('auth');
  await deleteComment(postId, commentId, auth.userId);
  return c.json(successResponse({ deleted: true }), 200);
});
