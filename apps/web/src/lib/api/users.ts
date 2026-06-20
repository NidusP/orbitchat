import type {
  GetProfileResponse,
  GetUserResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UpdateUserRequest,
  UpdateUserResponse,
} from '@orbitchat/shared-types';
import { apiRequest } from './client';

export async function getUser(userId: string): Promise<GetUserResponse> {
  return apiRequest<GetUserResponse>(`/api/v1/users/${userId}`);
}

export async function updateUser(
  userId: string,
  body: UpdateUserRequest
): Promise<UpdateUserResponse> {
  return apiRequest<UpdateUserResponse>(`/api/v1/users/${userId}`, {
    method: 'PATCH',
    body,
  });
}

export async function getProfile(userId: string): Promise<GetProfileResponse> {
  return apiRequest<GetProfileResponse>(`/api/v1/users/${userId}/profile`);
}

export async function updateProfile(
  userId: string,
  body: UpdateProfileRequest
): Promise<UpdateProfileResponse> {
  return apiRequest<UpdateProfileResponse>(`/api/v1/users/${userId}/profile`, {
    method: 'PATCH',
    body,
  });
}
