import { z, type ZodError } from 'zod';
import { AppError } from './errors';

interface ZodIssueLike {
  path: Array<string | number>;
  message: string;
}

export interface ZodErrorLike {
  issues: ZodIssueLike[];
}

export function validationErrorFromZod(error: ZodError | ZodErrorLike, fieldOverride?: string): AppError {
  const firstIssue = error.issues[0];
  const field =
    fieldOverride ?? (firstIssue.path.length > 0 ? String(firstIssue.path[0]) : undefined);

  return new AppError('VALIDATION_ERROR', firstIssue.message, 400, {
    field,
    issues: error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    })),
  });
}

export function parseUuidParam(rawId: string, field: string, message: string): string {
  const parsed = z.string().uuid(message).safeParse(rawId);

  if (!parsed.success) {
    throw validationErrorFromZod(parsed.error, field);
  }

  return parsed.data;
}
