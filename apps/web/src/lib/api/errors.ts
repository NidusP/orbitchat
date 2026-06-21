import type { ApiResponse } from '@orbitchat/shared-types';
import { isSuccessResponse } from '@orbitchat/shared-types';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function parseApiError(body: ApiResponse<unknown>, status: number): ApiError {
  if (isSuccessResponse(body)) {
    return new ApiError('INTERNAL_ERROR', 'Unexpected success response on error status', status);
  }

  if ('code' in body && typeof body.code === 'string' && typeof body.message === 'string') {
    return new ApiError(body.code, body.message, status, body.details);
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    'success' in body &&
    body.success === false &&
    'error' in body &&
    typeof body.error === 'object' &&
    body.error !== null &&
    'issues' in body.error &&
    Array.isArray(body.error.issues)
  ) {
    const issues = body.error.issues as Array<{ message?: string; path?: Array<string | number> }>;
    const firstIssue = issues[0];
    const message = firstIssue?.message ?? 'Validation failed';

    return new ApiError('VALIDATION_ERROR', message, status, { issues });
  }

  return new ApiError('INTERNAL_ERROR', 'Request failed', status, body);
}
