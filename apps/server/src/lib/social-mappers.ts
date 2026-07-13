import type { CommentAuthorSummary, CommentWithAuthor, PostAuthorSummary, PostMediaItem, PostWithAuthor } from '@orbitchat/shared-types';
import type { Comment as DbComment } from '../db/schema/comments';
import type { Post as DbPost } from '../db/schema/posts';

function toIsoString(date: Date): string {
  return date.toISOString();
}

export function toPostWithAuthor(
  post: DbPost,
  author: PostAuthorSummary,
  likedByMe: boolean,
  media: PostMediaItem[] = []
): PostWithAuthor {
  return {
    id: post.id,
    authorId: post.authorId,
    content: post.content,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    media,
    createdAt: toIsoString(post.createdAt),
    updatedAt: toIsoString(post.updatedAt),
    author,
    likedByMe,
  };
}

export function toCommentWithAuthor(
  comment: DbComment,
  author: CommentAuthorSummary
): CommentWithAuthor {
  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    content: comment.content,
    createdAt: toIsoString(comment.createdAt),
    updatedAt: toIsoString(comment.updatedAt),
    author,
  };
}

export function toPostAuthorSummary(row: {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}): PostAuthorSummary {
  return {
    id: row.userId,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  };
}
