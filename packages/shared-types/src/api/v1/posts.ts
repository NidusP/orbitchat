import type { CursorPage } from '../cursor-pagination';
import type { CommentWithAuthor } from '../../domain/comment';
import type { PostWithAuthor } from '../../domain/post';

export interface CreatePostRequest {
  content: string;
}

export interface UpdatePostRequest {
  content: string;
}

export type GetPostResponse = PostWithAuthor;
export type CreatePostResponse = PostWithAuthor;
export type UpdatePostResponse = PostWithAuthor;

export type HomeFeedResponse = CursorPage<PostWithAuthor>;
export type UserPostsResponse = CursorPage<PostWithAuthor>;

export interface CreateCommentRequest {
  content: string;
}

export type CommentListResponse = CursorPage<CommentWithAuthor>;
export type CreateCommentResponse = CommentWithAuthor;

export interface LikePostResponse {
  liked: boolean;
  likeCount: number;
}

export interface UnlikePostResponse {
  liked: boolean;
  likeCount: number;
}
