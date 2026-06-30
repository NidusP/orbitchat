import type { CursorPage } from '../cursor-pagination';
import type { UserSearchResult } from '../../domain/follow';

export interface FollowUserResponse {
  following: boolean;
}

export interface UnfollowUserResponse {
  following: boolean;
}

export type FollowersListResponse = CursorPage<UserSearchResult>;
export type FollowingListResponse = CursorPage<UserSearchResult>;
export type UserSearchResponse = CursorPage<UserSearchResult>;
