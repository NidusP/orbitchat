import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError } from '../lib/errors';
import { errorResponse } from '../lib/response';

export function handleError(err: unknown, c: Context) {
  if (err instanceof AppError) {
    return c.json(
      errorResponse(err.code, err.message, err.details),
      err.statusCode as ContentfulStatusCode
    );
  }

  console.error('Unhandled error:', err);
  return c.json(errorResponse('INTERNAL_ERROR', 'Internal server error'), 500);
}

export function handleNotFound(c: Context) {
  return c.json(errorResponse('NOT_FOUND', 'Endpoint not found'), 404);
}
