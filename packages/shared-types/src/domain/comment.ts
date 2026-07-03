export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentAuthorSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CommentWithAuthor extends Comment {
  author: CommentAuthorSummary;
}
