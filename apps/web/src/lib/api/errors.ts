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

  return new ApiError(body.code, body.message, status, body.details);
}
