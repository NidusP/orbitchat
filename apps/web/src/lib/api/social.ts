import type {
  CursorPageParams,
  FollowUserResponse,
  FollowersListResponse,
  FollowingListResponse,
  UnfollowUserResponse,
  UserSearchResponse,
} from '@orbitchat/shared-types';
import { apiRequest } from './client';

function buildCursorQuery(params: CursorPageParams): string {
  const search = new URLSearchParams();
  if (params.cursor) {
    search.set('cursor', params.cursor);
  }
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function followUser(userId: string): Promise<FollowUserResponse> {
  return apiRequest<FollowUserResponse>(`/api/v1/users/${userId}/follow`, {
    method: 'POST',
  });
}

export async function unfollowUser(userId: string): Promise<UnfollowUserResponse> {
  return apiRequest<UnfollowUserResponse>(`/api/v1/users/${userId}/follow`, {
    method: 'DELETE',
  });
}

export async function getFollowers(
  userId: string,
  params: CursorPageParams = {}
): Promise<FollowersListResponse> {
  return apiRequest<FollowersListResponse>(
    `/api/v1/users/${userId}/followers${buildCursorQuery(params)}`
  );
}

export async function getFollowing(
  userId: string,
  params: CursorPageParams = {}
): Promise<FollowingListResponse> {
  return apiRequest<FollowingListResponse>(
    `/api/v1/users/${userId}/following${buildCursorQuery(params)}`
  );
}

export async function searchUsers(
  query: string,
  params: CursorPageParams = {}
): Promise<UserSearchResponse> {
  const search = new URLSearchParams();
  search.set('q', query);
  if (params.cursor) {
    search.set('cursor', params.cursor);
  }
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  return apiRequest<UserSearchResponse>(`/api/v1/users/search?${search.toString()}`);
}

/** Walk following pages until target is found or list ends (fine for small graphs). */
export async function isFollowingUser(
  viewerId: string,
  targetUserId: string
): Promise<boolean> {
  let cursor: string | undefined;

  do {
    const page = await getFollowing(viewerId, { cursor, limit: 50 });
    if (page.items.some((user) => user.id === targetUserId)) {
      return true;
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return false;
}
