import type { Profile, User } from '../../domain';

/** GET /api/v1/users/:id */
export type GetUserResponse = User;

/** PATCH /api/v1/users/:id */
export interface UpdateUserRequest {
  username?: string;
  email?: string;
}

export type UpdateUserResponse = User;

/** GET /api/v1/users/:id/profile */
export type GetProfileResponse = Profile;

/** PATCH /api/v1/users/:id/profile */
export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  /** Commits a pending avatar upload; mutually exclusive with avatarUrl (uploadId wins). */
  avatarUploadId?: string;
}

export type UpdateProfileResponse = Profile;

export interface UserWithProfile {
  user: User;
  profile: Profile;
}
