'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PostWithAuthor } from '@orbitchat/shared-types';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { EmptyState } from '@/components/ui/empty-state';
import { PostCardSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { useFeedPolling } from '@/hooks/use-feed-polling';
import { getHomeFeed } from '@/lib/api/feed';
import { likePost, unlikePost } from '@/lib/api/posts';
import {
  applyLikeOptimistic,
  applyLikeResult,
  mergeFeedPosts,
} from '@/lib/posts-utils';

export default function FeedPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useI18n();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [likePendingId, setLikePendingId] = useState<string | null>(null);
  const [hasNewPostsBanner, setHasNewPostsBanner] = useState(false);
  const postsRef = useRef<PostWithAuthor[]>([]);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const loadFirstPage = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setError(null);
      setIsLoadingFeed(true);
      setHasNewPostsBanner(false);
    }

    try {
      const page = await getHomeFeed({ limit: 20 });
      if (options?.silent) {
        const existingIds = new Set(postsRef.current.map((post) => post.id));
        const hasNewPosts = page.items.some((post) => !existingIds.has(post.id));
        if (hasNewPosts) {
          setHasNewPostsBanner(true);
        }
        setPosts((current) => mergeFeedPosts(current, page.items));
      } else {
        setPosts(page.items);
      }
      if (!options?.silent) {
        setNextCursor(page.nextCursor);
      }
    } catch {
      if (!options?.silent) {
        setError(t('feed.loadFailed'));
      }
    } finally {
      if (!options?.silent) {
        setIsLoadingFeed(false);
      }
    }
  }, [t]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadFirstPage();
    }
  }, [isAuthenticated, loadFirstPage]);

  const pollFeed = useCallback(() => {
    void loadFirstPage({ silent: true });
  }, [loadFirstPage]);

  useFeedPolling(pollFeed, isAuthenticated && !isLoadingFeed);

  async function handleLoadMore() {
    if (!nextCursor) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      const page = await getHomeFeed({ cursor: nextCursor, limit: 20 });
      setPosts((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      setError(t('feed.loadMoreFailed'));
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handlePostCreated(post: PostWithAuthor) {
    setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
  }

  function handleNewPostsBannerClick() {
    setHasNewPostsBanner(false);
    void loadFirstPage();
  }

  const newPostsBannerLabel = t('feed.newPostsBanner');
  const dismissBannerLabel = t('feed.dismissBanner');

  function handleCommentCountChange(postId: string, nextCount: number) {
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, commentCount: nextCount } : post))
    );
  }

  function handlePostUpdated(updated: PostWithAuthor) {
    setPosts((current) =>
      current.map((post) => (post.id === updated.id ? updated : post))
    );
  }

  function handlePostDeleted(postId: string) {
    setPosts((current) => current.filter((post) => post.id !== postId));
  }

  async function handleToggleLike(postId: string, currentlyLiked: boolean) {
    setLikePendingId(postId);
    setPosts((current) => applyLikeOptimistic(current, postId, !currentlyLiked));

    try {
      const result = currentlyLiked ? await unlikePost(postId) : await likePost(postId);
      setPosts((current) => applyLikeResult(current, postId, result.liked, result.likeCount));
    } catch {
      setPosts((current) => applyLikeOptimistic(current, postId, currentlyLiked));
      setError(t('feed.likeUpdateFailed'));
    } finally {
      setLikePendingId(null);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <main className="main-wide">
        <header className="page-header section-header">
          <div>
            <h1>{t('feed.title')}</h1>
            <p className="text-muted">{t('feed.loadingHint')}</p>
          </div>
        </header>
        <PostCardSkeleton count={3} />
      </main>
    );
  }

  return (
    <main className="main-wide">
      <header className="page-header section-header">
        <div>
          <h1>{t('feed.title')}</h1>
          <p className="text-muted">{t('feed.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadFirstPage()}>
          {t('feed.refresh')}
        </button>
      </header>

      {hasNewPostsBanner && (
        <div className="feed-new-posts-banner" data-testid="feed-new-posts-banner" role="status">
          <button
            type="button"
            className="feed-new-posts-banner-refresh"
            onClick={handleNewPostsBannerClick}
          >
            {newPostsBannerLabel}
          </button>
          <button
            type="button"
            className="feed-new-posts-banner-dismiss"
            onClick={() => setHasNewPostsBanner(false)}
            aria-label={dismissBannerLabel}
          >
            x
          </button>
        </div>
      )}

      <div className="card">
        <PostComposer onCreated={handlePostCreated} />
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {isLoadingFeed ? (
        <PostCardSkeleton count={3} />
      ) : posts.length === 0 ? (
        <div style={{ marginTop: 16 }}>
          <EmptyState
            title={t('feed.emptyTitle')}
            description={t('feed.emptyDescription')}
            actionLabel={t('feed.discoverUsers')}
            href="/search"
          />
        </div>
      ) : (
        <div className="post-list">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id ?? null}
              likePending={likePendingId === post.id}
              onToggleLike={handleToggleLike}
              onCommentCountChange={handleCommentCountChange}
              onPostUpdated={handlePostUpdated}
              onPostDeleted={handlePostDeleted}
            />
          ))}
        </div>
      )}

      {nextCursor && (
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isLoadingMore}
            onClick={() => void handleLoadMore()}
          >
            {isLoadingMore ? t('common.loading') : t('feed.loadMore')}
          </button>
        </div>
      )}
    </main>
  );
}
