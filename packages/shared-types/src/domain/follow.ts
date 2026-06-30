export interface Follow {
  id: string;
  followerId: string;
  followeeId: string;
  createdAt: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}
