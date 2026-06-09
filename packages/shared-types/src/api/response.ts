/**
 * API Response Types
 * 
 * All API responses follow a unified format for consistency.
 */

export interface SuccessResponse<T = unknown> {
  code: 'SUCCESS';
  data: T;
  timestamp: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * Type guard to check if a response is a success response
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is SuccessResponse<T> {
  return response.code === 'SUCCESS';
}

/**
 * Type guard to check if a response is an error response
 */
export function isErrorResponse(response: ApiResponse): response is ErrorResponse {
  return response.code !== 'SUCCESS';
}
