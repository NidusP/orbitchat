import { z } from 'zod';
import { MAX_CURSOR_LIMIT } from '@orbitchat/shared-types';

export const aiCursorQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_CURSOR_LIMIT).optional(),
});

export const createAiConversationSchema = z.object({
  agentId: z.string().uuid('Invalid agent id'),
  title: z.string().trim().min(1).max(200).optional(),
});

export const createAiMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(4000, 'Content must be at most 4000 characters'),
});

export const userAgentMemoryKindSchema = z.enum(['preference', 'fact', 'nickname']);

export const createUserAgentMemorySchema = z.object({
  kind: userAgentMemoryKindSchema,
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(500, 'Content must be at most 500 characters'),
});

export const listUserAgentMemoriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type AiCursorQueryInput = z.infer<typeof aiCursorQuerySchema>;
export type CreateAiConversationInput = z.infer<typeof createAiConversationSchema>;
export type CreateAiMessageInput = z.infer<typeof createAiMessageSchema>;
export type CreateUserAgentMemoryInput = z.infer<typeof createUserAgentMemorySchema>;
export type ListUserAgentMemoriesQueryInput = z.infer<typeof listUserAgentMemoriesQuerySchema>;
