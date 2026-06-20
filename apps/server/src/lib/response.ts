import type { ErrorResponse, SuccessResponse } from '@orbitchat/shared-types';

export function successResponse<T>(data: T): SuccessResponse<T> {
  return {
    code: 'SUCCESS',
    data,
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(
  code: string,
  message: string,
  details?: unknown
): ErrorResponse {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
  };
}
