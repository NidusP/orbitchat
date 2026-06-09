/**
 * Shared Types - API and Domain Model Definitions
 * 
 * This package defines all the type contracts between frontend and backend.
 * All types here should be frontend-agnostic and backend-agnostic.
 * 
 * Structure:
 * - api/     - API request/response types
 * - domain/  - Business domain models
 * - utils/   - Type utilities and guards
 */

export type { ApiResponse, SuccessResponse, ErrorResponse } from './api/response';
export type { PaginatedResponse, PaginationParams } from './api/pagination';
