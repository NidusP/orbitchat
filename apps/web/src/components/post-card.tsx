'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import type { PostMediaItem, PostWithAuthor } from '@orbitchat/shared-types';
import { PostComments } from '@/components/post-comments';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useI18n } from '@/contexts/i18n-context';
import { ApiError } from '@/lib/api/errors';
import { resolveMediaUrl } from '@/lib/media-url';
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

function PostMediaGrid({ media }: { media: PostMediaItem[] }) {
  const { t } = useI18n();

  if (media.length === 0) {
    return null;
  }

  const sortedMedia = [...media].sort((a, b) => a.sortOrder - b.sortOrder);
  const gridClass =
    sortedMedia.length === 1 ? 'post-media-grid-1' : `post-media-grid-${Math.min(sortedMedia.length, 4)}`;

  return (
    <div className={`post-media-grid ${gridClass}`} data-testid="post-media-grid">
      {sortedMedia.map((item, index) => (
        <a
          key={item.id}
          className="post-media-item"
          href={resolveMediaUrl(item.url)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={resolveMediaUrl(item.url)}
            alt={t('postCard.mediaAlt', { index: index + 1 })}
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
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
  const { t } = useI18n();
  const isAuthor = currentUserId !== null && post.authorId === currentUserId;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [manageError, setManageError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasContent = post.content.trim().length > 0;

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
      setManageError(err instanceof ApiError ? err.message : t('postCard.errors.update'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('postCard.confirmDelete'))) {
      return;
    }

    setIsDeleting(true);
    setManageError(null);

    try {
      await deletePost(post.id);
      onPostDeleted?.(post.id);
    } catch (err) {
      setManageError(err instanceof ApiError ? err.message : t('postCard.errors.delete'));
      setIsDeleting(false);
    }
  }

  return (
    <article className="post-card" data-testid={`feed-post-${post.id}`}>
      <header className="post-card-header">
        <Link href={`/users/${post.author.id}`} className="post-author-link">
          <UserAvatar
            displayName={post.author.displayName}
            userId={post.author.id}
            avatarUrl={post.author.avatarUrl}
            size="sm"
          />
          <span className="post-author-meta">
            <strong>{post.author.displayName}</strong>
            <span className="text-muted"> @{post.author.username}</span>
          </span>
        </Link>
        <time className="text-muted" dateTime={post.createdAt}>
          {formatRelativeTime(post.createdAt)}
        </time>
      </header>

      {manageError && <div className="alert alert-error">{manageError}</div>}

      {isEditing ? (
        <form className="form" onSubmit={handleSaveEdit}>
          <div className="field">
            <label htmlFor={`edit-post-${post.id}`}>{t('postCard.editLabel')}</label>
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
              {isSaving ? t('postCard.actions.saving') : t('postCard.actions.save')}
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
              {t('postCard.actions.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <>
          {hasContent && (
            <p className="post-content" data-testid={`post-content-${post.id}`}>
              {post.content}
            </p>
          )}
          <PostMediaGrid media={post.media} />
        </>
      )}

      {isAuthor && !isEditing && (
        <div className="post-owner-actions">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid={`post-edit-${post.id}`}
            onClick={() => setIsEditing(true)}
          >
            {t('postCard.actions.edit')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            data-testid={`post-delete-${post.id}`}
            disabled={isDeleting}
            onClick={() => void handleDelete()}
          >
            {isDeleting ? t('postCard.actions.deleting') : t('postCard.actions.delete')}
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
          {post.likedByMe ? t('postCard.actions.liked') : t('postCard.actions.like')} ({post.likeCount})
        </button>
        <PostComments
          postId={post.id}
          postAuthorId={post.authorId}
          commentCount={post.commentCount}
          currentUserId={currentUserId}
          onCommentCountChange={(count) => onCommentCountChange?.(post.id, count)}
          toggleLabel={t('postCard.comments')}
          hideLabel={t('postCard.hideComments')}
        />
      </footer>
    </article>
  );
}
