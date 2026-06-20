import { isValidEmail, isValidPassword, normalizeEmail } from '@orbitchat/shared-utils';
import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z
    .string()
    .trim()
    .refine(isValidEmail, 'Invalid email format')
    .transform(normalizeEmail),
  password: z.string().refine(isValidPassword, 'Password does not meet requirements'),
  displayName: z.string().trim().min(1, 'Display name is required').max(128),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .refine(isValidEmail, 'Invalid email format')
    .transform(normalizeEmail),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
  trustDevice: z.boolean().optional(),
  deviceName: z.string().trim().max(128).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const trustSessionSchema = z.object({
  trust: z.boolean(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type TrustSessionInput = z.infer<typeof trustSessionSchema>;
