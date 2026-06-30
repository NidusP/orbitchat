import { z } from 'zod';
import { MAX_CURSOR_LIMIT } from '@orbitchat/shared-types';

export const cursorQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_CURSOR_LIMIT).optional(),
});

export const postContentSchema = z
  .string()
  .trim()
  .min(1, 'Content is required')
  .max(2000, 'Content must be at most 2000 characters');

export const createPostSchema = z.object({
  content: postContentSchema,
});

export const updatePostSchema = z.object({
  content: postContentSchema,
});

export const commentContentSchema = z
  .string()
  .trim()
  .min(1, 'Content is required')
  .max(1000, 'Content must be at most 1000 characters');

export const createCommentSchema = z.object({
  content: commentContentSchema,
});

export const userSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(64),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_CURSOR_LIMIT).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CursorQueryInput = z.infer<typeof cursorQuerySchema>;
export type UserSearchQueryInput = z.infer<typeof userSearchQuerySchema>;
