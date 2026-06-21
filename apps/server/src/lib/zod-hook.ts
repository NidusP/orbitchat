import type { Hook } from '@hono/zod-validator';
import type { Env } from 'hono';
import { validationErrorFromZod, type ZodErrorLike } from './validation';

export const zodValidationHook: Hook<unknown, Env, string> = (result) => {
  if (!result.success) {
    throw validationErrorFromZod(result.error as ZodErrorLike);
  }
};
