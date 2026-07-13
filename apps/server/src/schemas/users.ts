import { isValidEmail, normalizeEmail } from '@orbitchat/shared-utils';
import { z } from 'zod';

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be at most 32 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores');

export const userIdParamSchema = z.string().uuid('Invalid user id');

export const updateUserSchema = z
  .object({
    username: usernameSchema.optional(),
    email: z
      .string()
      .trim()
      .refine(isValidEmail, 'Invalid email format')
      .transform(normalizeEmail)
      .optional(),
  })
  .refine((data) => data.username !== undefined || data.email !== undefined, {
    message: 'At least one field is required',
  });

export const updateProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Display name is required')
      .max(128, 'Display name must be at most 128 characters')
      .optional(),
    bio: z.string().max(500, 'Bio must be at most 500 characters').nullable().optional(),
    avatarUrl: z.string().url('Invalid avatar URL').max(512).nullable().optional(),
    avatarUploadId: z.string().uuid('Invalid avatar upload id').optional(),
  })
  .refine((data) => data.avatarUrl === undefined || data.avatarUploadId === undefined, {
    message: 'avatarUrl and avatarUploadId are mutually exclusive',
    path: ['avatarUploadId'],
  })
  .refine(
    (data) =>
      data.displayName !== undefined ||
      data.bio !== undefined ||
      data.avatarUrl !== undefined ||
      data.avatarUploadId !== undefined,
    {
      message: 'At least one field is required',
    }
  );

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
