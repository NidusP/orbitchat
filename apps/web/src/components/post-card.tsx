'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import type { PostWithAuthor } from '@orbitchat/shared-types';
import { PostComments } from '@/components/post-comments';
import { ApiError } from '@/lib/api/errors';
import { deletePost, updatePost } from '@/lib/api/posts';
import { formatRelativeTime } from '@/lib/posts-utils';

interface PostCardProps {
  post: PostWithAuthor;
  currentUserId: string | null;
  onToggleLike: (postId: string, currentlyLiked: boolean) => void;
  onCommentCountChange?: (postId: string, nextCount: number) => void;
  onPostUpdated?: (post: PostWithAuthor) => void;
  onPostDeleted?: (postId: string) => void;
  likePending?: boolean;
}

export function PostCard({
  post,
  currentUserId,
  onToggleLike,
  onCommentCountChange,
  onPostUpdated,
  onPostDeleted,
  likePending = false,
}: PostCardProps) {
  const isAuthor = currentUserId !== null && post.authorId === currentUserId;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [manageError, setManageError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = editContent.trim();
    if (trimmed === '') {
      return;
    }

    setIsSaving(true);
    setManageError(null);

    try {
      const updated = await updatePost(post.id, { content: trimmed });
      onPostUpdated?.(updated);
      setIsEditing(false);
    } catch (err) {
      setManageError(err instanceof ApiError ? err.message : 'Failed to update post.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this post?')) {
      return;
    }

    setIsDeleting(true);
    setManageError(null);

    try {
      await deletePost(post.id);
      onPostDeleted?.(post.id);
    } catch (err) {
      setManageError(err instanceof ApiError ? err.message : 'Failed to delete post.');
      setIsDeleting(false);
    }
  }

  return (
    <article className="post-card" data-testid={`feed-post-${post.id}`}>
      <header className="post-card-header">
        <Link href={`/users/${post.author.id}`} className="post-author-link">
          <strong>{post.author.displayName}</strong>
          <span className="text-muted"> @{post.author.username}</span>
        </Link>
        <time className="text-muted" dateTime={post.createdAt}>
          {formatRelativeTime(post.createdAt)}
        </time>
      </header>

      {manageError && <div className="alert alert-error">{manageError}</div>}

      {isEditing ? (
        <form className="form" onSubmit={handleSaveEdit}>
          <div className="field">
            <label htmlFor={`edit-post-${post.id}`}>Edit post</label>
            <textarea
              id={`edit-post-${post.id}`}
              data-testid={`post-edit-input-${post.id}`}
              maxLength={2000}
              rows={3}
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
            />
          </div>
          <div className="post-card-actions">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              data-testid={`post-edit-save-${post.id}`}
              disabled={isSaving || editContent.trim() === ''}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setIsEditing(false);
                setEditContent(post.content);
                setManageError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="post-content" data-testid={`post-content-${post.id}`}>
          {post.content}
        </p>
      )}

      {isAuthor && !isEditing && (
        <div className="post-owner-actions">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid={`post-edit-${post.id}`}
            onClick={() => setIsEditing(true)}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            data-testid={`post-delete-${post.id}`}
            disabled={isDeleting}
            onClick={() => void handleDelete()}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}

      <footer className="post-card-footer">
        <button
          type="button"
          className={`btn btn-sm ${post.likedByMe ? 'btn-like-active' : 'btn-secondary'}`}
          data-testid={`post-like-${post.id}`}
          disabled={likePending}
          onClick={() => onToggleLike(post.id, post.likedByMe)}
        >
          {post.likedByMe ? '♥ Liked' : '♡ Like'} ({post.likeCount})
        </button>
        <PostComments
          postId={post.id}
          commentCount={post.commentCount}
          currentUserId={currentUserId}
          onCommentCountChange={(count) => onCommentCountChange?.(post.id, count)}
        />
      </footer>
    </article>
  );
}
