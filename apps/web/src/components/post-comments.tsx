'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { CommentWithAuthor } from '@orbitchat/shared-types';
import { ApiError } from '@/lib/api/errors';
import { createComment, deleteComment, getPostComments } from '@/lib/api/posts';
import { formatRelativeTime } from '@/lib/posts-utils';

interface PostCommentsProps {
  postId: string;
  postAuthorId: string;
  commentCount: number;
  currentUserId: string | null;
  onCommentCountChange?: (nextCount: number) => void;
}

export function PostComments({
  postId,
  postAuthorId,
  commentCount,
  currentUserId,
  onCommentCountChange,
}: PostCommentsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const page = await getPostComments(postId, { limit: 20 });
      setComments(page.items);
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load comments.');
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (isOpen && !hasLoaded) {
      void loadComments();
    }
  }, [isOpen, hasLoaded, loadComments]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (trimmed === '') {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await createComment(postId, { content: trimmed });
      setComments((current) => [created, ...current]);
      setContent('');
      onCommentCountChange?.(commentCount + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to post comment.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!window.confirm('Delete this comment?')) {
      return;
    }

    setError(null);

    try {
      await deleteComment(postId, commentId);
      setComments((current) => current.filter((item) => item.id !== commentId));
      onCommentCountChange?.(Math.max(0, commentCount - 1));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete comment.');
    }
  }

  return (
    <div className="post-comments">
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        data-testid={`post-comments-toggle-${postId}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? 'Hide comments' : 'Comments'} ({commentCount})
      </button>

      {isOpen && (
        <div className="post-comments-panel" data-testid={`post-comments-panel-${postId}`}>
          <form className="form comment-form" onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="field">
              <label htmlFor={`comment-${postId}`}>Add a comment</label>
              <textarea
                id={`comment-${postId}`}
                data-testid={`comment-input-${postId}`}
                maxLength={1000}
                rows={2}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write a comment…"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              data-testid={`comment-submit-${postId}`}
              disabled={isSubmitting || content.trim() === ''}
            >
              {isSubmitting ? 'Posting…' : 'Comment'}
            </button>
          </form>

          {isLoading ? (
            <p className="text-muted">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-muted">No comments yet.</p>
          ) : (
            <ul className="comment-list">
              {comments.map((comment) => {
                const canDelete =
                  currentUserId !== null &&
                  (comment.authorId === currentUserId || postAuthorId === currentUserId);

                return (
                <li
                  key={comment.id}
                  className="comment-item"
                  data-testid={`comment-item-${comment.id}`}
                >
                  <div className="comment-item-header">
                    <strong>{comment.author.displayName}</strong>
                    <span className="text-muted"> @{comment.author.username}</span>
                    <time className="text-muted" dateTime={comment.createdAt}>
                      {formatRelativeTime(comment.createdAt)}
                    </time>
                    {canDelete && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger comment-delete-btn"
                        data-testid={`comment-delete-${comment.id}`}
                        onClick={() => void handleDeleteComment(comment.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="comment-content">{comment.content}</p>
                </li>
              );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
