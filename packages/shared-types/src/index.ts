/**
 * Shared Types - API and Domain Model Definitions
 *
 * This package defines all type contracts between frontend and backend.
 * All types here should be frontend-agnostic and backend-agnostic.
 *
 * Structure:
 * - api/     - API request/response types
 * - domain/  - Business domain models
 * - utils/   - Type utilities and guards
 */

export type { ApiResponse, SuccessResponse, ErrorResponse } from './api/response';
export { isErrorResponse, isSuccessResponse } from './api/response';
export type { PaginatedResponse, PaginationParams } from './api/pagination';
export { calculateOffset, hasNextPage } from './api/pagination';

export type {
  AuthTokens,
  LoginRequest,
  LoginResponse,
  LogoutAllResponse,
  LogoutResponse,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
  RevokeSessionResponse,
  SessionListResponse,
  TrustSessionRequest,
  TrustSessionResponse,
} from './api/v1/auth';
export type {
  GetProfileResponse,
  GetUserResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UpdateUserRequest,
  UpdateUserResponse,
  UserWithProfile,
} from './api/v1/users';

export type { ClientPlatform } from './domain/client';
export { CLIENT_PLATFORMS, isClientPlatform } from './domain/client';
export type { Profile } from './domain/profile';
export type { UserSession } from './domain/session';
export type { User } from './domain/user';

export { isClientPlatform as isValidClientPlatform } from './utils/guards';
