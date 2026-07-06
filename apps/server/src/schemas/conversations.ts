import { z } from 'zod';
import { MAX_CURSOR_LIMIT } from '@orbitchat/shared-types';

export const DEFAULT_MESSAGE_LIMIT = 30;
export const MAX_MESSAGE_LIMIT = 50;

export const cursorQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_CURSOR_LIMIT).optional(),
});

export const messageCursorQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_MESSAGE_LIMIT).optional(),
});

export const messageContentSchema = z
  .string()
  .trim()
  .min(1, 'Content is required')
  .max(2000, 'Content must be at most 2000 characters');

export const createConversationSchema = z.object({
  participantUserId: z.string().uuid('Invalid participant user id'),
});

export const createMessageSchema = z.object({
  content: messageContentSchema,
});

export const markConversationReadSchema = z.object({
  readAt: z.string().datetime({ message: 'readAt must be ISO 8601' }).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type MarkConversationReadInput = z.infer<typeof markConversationReadSchema>;
export type CursorQueryInput = z.infer<typeof cursorQuerySchema>;
export type MessageCursorQueryInput = z.infer<typeof messageCursorQuerySchema>;

export function clampMessageLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_MESSAGE_LIMIT;
  }
  return Math.min(Math.max(1, limit), MAX_MESSAGE_LIMIT);
}
