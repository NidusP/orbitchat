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

export const createDirectConversationSchema = z.object({
  participantUserId: z.string().uuid('Invalid participant user id'),
});

export const createGroupConversationSchema = z.object({
  type: z.literal('group'),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(120, 'Title must be at most 120 characters'),
  memberUserIds: z
    .array(z.string().uuid('Invalid member user id'))
    .min(1, 'At least one member is required')
    .max(49, 'A group can have at most 50 members including the creator'),
});

export const createConversationSchema = z.union([
  createDirectConversationSchema,
  createGroupConversationSchema,
]);

export const createMessageSchema = z.object({
  content: messageContentSchema,
});

export const updateMessageSchema = z.object({
  content: messageContentSchema,
});

export const markConversationReadSchema = z.object({
  readAt: z.string().datetime({ message: 'readAt must be ISO 8601' }).optional(),
});

export const updateGroupConversationSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(120, 'Title must be at most 120 characters')
      .optional(),
    announcement: z
      .string()
      .trim()
      .max(1000, 'Announcement must be at most 1000 characters')
      .nullable()
      .optional(),
    expectedVersion: z
      .number()
      .int('expectedVersion must be an integer')
      .positive('expectedVersion must be a positive integer'),
  })
  .refine((data) => data.title !== undefined || data.announcement !== undefined, {
    message: 'At least one of title or announcement is required',
  });

export const addGroupMembersSchema = z.object({
  userIds: z
    .array(z.string().uuid('Invalid user id'))
    .min(1, 'At least one user id is required')
    .max(49, 'Cannot add more than 49 members at once'),
});

export const transferGroupOwnerSchema = z.object({
  newOwnerUserId: z.string().uuid('Invalid user id'),
});

export const updateGroupMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

export const createGroupInviteSchema = z.object({
  expiresInHours: z.coerce.number().int().min(1).max(24 * 30).optional(),
  maxUses: z.coerce.number().int().min(1).max(1000).optional(),
});

export type CreateDirectConversationInput = z.infer<typeof createDirectConversationSchema>;
export type CreateGroupConversationInput = z.infer<typeof createGroupConversationSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type MarkConversationReadInput = z.infer<typeof markConversationReadSchema>;
export type CursorQueryInput = z.infer<typeof cursorQuerySchema>;
export type MessageCursorQueryInput = z.infer<typeof messageCursorQuerySchema>;

export function clampMessageLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_MESSAGE_LIMIT;
  }
  return Math.min(Math.max(1, limit), MAX_MESSAGE_LIMIT);
}
