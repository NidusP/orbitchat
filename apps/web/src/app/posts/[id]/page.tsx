'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PostWithAuthor } from '@orbitchat/shared-types';
import { PostCard } from '@/components/post-card';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { getPost, likePost, unlikePost } from '@/lib/api/posts';
import { applyLikeOptimistic, applyLikeResult } from '@/lib/posts-utils';

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useI18n();
  const [post, setPost] = useState<PostWithAuthor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPost, setIsLoadingPost] = useState(true);
  const [likePending, setLikePending] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadPost() {
      setIsLoadingPost(true);
      setError(null);

      try {
        const loaded = await getPost(params.id);
        if (!cancelled) {
          setPost(loaded);
        }
      } catch {
        if (!cancelled) {
          setError(t('notifications.postLoadFailed'));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPost(false);
        }
      }
    }

    if (isAuthenticated && params.id) {
      void loadPost();
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, params.id, t]);

  async function handleToggleLike(postId: string, currentlyLiked: boolean) {
    if (!post) {
      return;
    }

    setLikePending(true);
    setPost((current) => (current ? applyLikeOptimistic([current], postId, !currentlyLiked)[0] : current));

    try {
      const result = currentlyLiked ? await unlikePost(postId) : await likePost(postId);
      setPost((current) =>
        current ? applyLikeResult([current], postId, result.liked, result.likeCount)[0] : current
      );
    } catch {
      setPost((current) =>
        current ? applyLikeOptimistic([current], postId, currentlyLiked)[0] : current
      );
      setError(t('feed.likeUpdateFailed'));
    } finally {
      setLikePending(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <main className="main-wide">
        <p className="text-muted">{t('common.loading')}</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <header className="page-header">
        <h1>{t('notifications.postDetailTitle')}</h1>
        <p className="text-muted">
          <Link href="/notifications">{t('notifications.backToNotifications')}</Link>
        </p>
      </header>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {isLoadingPost ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : post ? (
        <PostCard
          post={post}
          currentUserId={user?.id ?? null}
          likePending={likePending}
          onToggleLike={handleToggleLike}
          onCommentCountChange={(postId, nextCount) => {
            setPost((current) =>
              current && current.id === postId ? { ...current, commentCount: nextCount } : current
            );
          }}
          onPostUpdated={setPost}
          onPostDeleted={() => {
            router.push('/feed');
          }}
        />
      ) : (
        <p className="text-muted">{t('notifications.postNotFound')}</p>
      )}
    </main>
  );
}
