import type {
  CommentListResponse,
  CreateCommentRequest,
  CreateCommentResponse,
  CreatePostRequest,
  CreatePostResponse,
  CursorPageParams,
  GetPostResponse,
  LikePostResponse,
  UnlikePostResponse,
  UpdatePostRequest,
  UpdatePostResponse,
  UserPostsResponse,
} from '@orbitchat/shared-types';
import { apiRequest } from './client';

function buildQuery(params: CursorPageParams): string {
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

export async function createPost(body: CreatePostRequest): Promise<CreatePostResponse> {
  return apiRequest<CreatePostResponse>('/api/v1/posts', {
    method: 'POST',
    body,
  });
}

export async function getPost(postId: string): Promise<GetPostResponse> {
  return apiRequest<GetPostResponse>(`/api/v1/posts/${postId}`);
}

export async function updatePost(
  postId: string,
  body: UpdatePostRequest
): Promise<UpdatePostResponse> {
  return apiRequest<UpdatePostResponse>(`/api/v1/posts/${postId}`, {
    method: 'PATCH',
    body,
  });
}

export async function deletePost(postId: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/api/v1/posts/${postId}`, {
    method: 'DELETE',
  });
}

export async function likePost(postId: string): Promise<LikePostResponse> {
  return apiRequest<LikePostResponse>(`/api/v1/posts/${postId}/like`, {
    method: 'POST',
  });
}

export async function unlikePost(postId: string): Promise<UnlikePostResponse> {
  return apiRequest<UnlikePostResponse>(`/api/v1/posts/${postId}/like`, {
    method: 'DELETE',
  });
}

export async function getUserPosts(
  userId: string,
  params: CursorPageParams = {}
): Promise<UserPostsResponse> {
  return apiRequest<UserPostsResponse>(`/api/v1/users/${userId}/posts${buildQuery(params)}`);
}

export async function getPostComments(
  postId: string,
  params: CursorPageParams = {}
): Promise<CommentListResponse> {
  return apiRequest<CommentListResponse>(
    `/api/v1/posts/${postId}/comments${buildQuery(params)}`
  );
}

export async function createComment(
  postId: string,
  body: CreateCommentRequest
): Promise<CreateCommentResponse> {
  return apiRequest<CreateCommentResponse>(`/api/v1/posts/${postId}/comments`, {
    method: 'POST',
    body,
  });
}

export async function deleteComment(
  postId: string,
  commentId: string
): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/api/v1/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
  });
}
