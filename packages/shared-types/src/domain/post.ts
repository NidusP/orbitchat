export interface Post {
  id: string;
  authorId: string;
  content: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PostAuthorSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Post with author info for feed and detail views. */
export interface PostWithAuthor extends Post {
  author: PostAuthorSummary;
  likedByMe: boolean;
}
