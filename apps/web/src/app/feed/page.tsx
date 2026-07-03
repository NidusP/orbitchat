'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PostWithAuthor } from '@orbitchat/shared-types';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { SiteNav } from '@/components/site-nav';
import { useAuth } from '@/contexts/auth-context';
import { useFeedPolling } from '@/hooks/use-feed-polling';
import { getHomeFeed } from '@/lib/api/feed';
import { ApiError } from '@/lib/api/errors';
import { likePost, unlikePost } from '@/lib/api/posts';
import {
  applyLikeOptimistic,
  applyLikeResult,
  mergeFeedPosts,
} from '@/lib/posts-utils';

export default function FeedPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [likePendingId, setLikePendingId] = useState<string | null>(null);

  const loadFirstPage = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setError(null);
      setIsLoadingFeed(true);
    }

    try {
      const page = await getHomeFeed({ limit: 20 });
      setPosts((current) => (options?.silent ? mergeFeedPosts(current, page.items) : page.items));
      if (!options?.silent) {
        setNextCursor(page.nextCursor);
      }
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof ApiError ? err.message : 'Failed to load feed.');
      }
    } finally {
      if (!options?.silent) {
        setIsLoadingFeed(false);
      }
    }
  }, []);

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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load more posts.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handlePostCreated(post: PostWithAuthor) {
    setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
  }

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
    } catch (err) {
      setPosts((current) => applyLikeOptimistic(current, postId, currentlyLiked));
      setError(err instanceof ApiError ? err.message : 'Failed to update like.');
    } finally {
      setLikePendingId(null);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <main className="main-wide">
        <SiteNav />
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <SiteNav />
      <header className="page-header section-header">
        <div>
          <h1>Home feed</h1>
          <p className="text-muted">Posts from people you follow · auto-refreshes every 60s</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadFirstPage()}>
          Refresh
        </button>
      </header>

      <div className="card">
        <PostComposer onCreated={handlePostCreated} />
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {isLoadingFeed ? (
        <p className="text-muted" style={{ marginTop: 16 }}>
          Loading feed…
        </p>
      ) : posts.length === 0 ? (
        <div className="card empty-state" style={{ marginTop: 16 }}>
          <p>No posts yet. Follow someone from <Link href="/search">search</Link> or publish your first post.</p>
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
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </main>
  );
}
