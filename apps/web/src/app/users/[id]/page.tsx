'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PostWithAuthor, Profile, User } from '@orbitchat/shared-types';
import { PostCard } from '@/components/post-card';
import { SiteNav } from '@/components/site-nav';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/errors';
import { likePost, unlikePost, getUserPosts } from '@/lib/api/posts';
import {
  applyLikeOptimistic,
  applyLikeResult,
} from '@/lib/posts-utils';
import {
  followUser,
  isFollowingUser,
  unfollowUser,
} from '@/lib/api/social';
import { createConversation } from '@/lib/api/conversations';
import { getProfile, getUser } from '@/lib/api/users';

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const router = useRouter();
  const { user: viewer, isAuthenticated, isLoading: authLoading } = useAuth();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followKnown, setFollowKnown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [messagePending, setMessagePending] = useState(false);
  const [likePendingId, setLikePendingId] = useState<string | null>(null);

  const isSelf = viewer?.id === userId;

  const loadPosts = useCallback(
    async (cursor?: string) => {
      const page = await getUserPosts(userId, { cursor, limit: 20 });
      setPosts((current) => (cursor ? [...current, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    },
    [userId]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoadingPage(true);
      setError(null);

      try {
        const [userRecord, profileRecord] = await Promise.all([
          getUser(userId),
          getProfile(userId),
        ]);

        if (cancelled) {
          return;
        }

        setProfileUser(userRecord);
        setProfile(profileRecord);
        await loadPosts();

        if (viewer && !cancelled && viewer.id !== userId) {
          const following = await isFollowingUser(viewer.id, userId);
          if (!cancelled) {
            setIsFollowing(following);
            setFollowKnown(true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? `加载用户失败：${err.message}` : '加载用户失败。');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPage(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [userId, viewer, loadPosts]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  async function handleToggleFollow() {
    if (!viewer || isSelf) {
      return;
    }

    setFollowPending(true);
    setError(null);

    try {
      if (isFollowing) {
        await unfollowUser(userId);
        setIsFollowing(false);
      } else {
        await followUser(userId);
        setIsFollowing(true);
      }
      setFollowKnown(true);
    } catch (err) {
      setError(err instanceof ApiError ? `更新关注失败：${err.message}` : '更新关注失败。');
    } finally {
      setFollowPending(false);
    }
  }

  async function handleLoadMore() {
    if (!nextCursor) {
      return;
    }

    setIsLoadingMore(true);
    try {
      await loadPosts(nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? `加载更多动态失败：${err.message}` : '加载更多动态失败。');
    } finally {
      setIsLoadingMore(false);
    }
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

  async function handleMessage() {
    if (!viewer || isSelf) {
      return;
    }

    setMessagePending(true);
    setError(null);

    try {
      const conversation = await createConversation({ participantUserId: userId });
      router.push(`/messages/${conversation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? `发起私聊失败：${err.message}` : '发起私聊失败。');
    } finally {
      setMessagePending(false);
    }
  }

  async function handleToggleLike(postId: string, currentlyLiked: boolean) {
    setLikePendingId(postId);
    setPosts((current) => applyLikeOptimistic(current, postId, !currentlyLiked));

    try {
      const result = currentlyLiked ? await unlikePost(postId) : await likePost(postId);
      setPosts((current) => applyLikeResult(current, postId, result.liked, result.likeCount));
    } catch (err) {
      setPosts((current) => applyLikeOptimistic(current, postId, currentlyLiked));
      setError(err instanceof ApiError ? `更新点赞失败：${err.message}` : '更新点赞失败。');
    } finally {
      setLikePendingId(null);
    }
  }

  if (authLoading || isLoadingPage) {
    return (
      <main className="main-wide">
        <SiteNav />
        <p className="text-muted">正在加载...</p>
      </main>
    );
  }

  if (error && !profileUser) {
    return (
      <main className="main-wide">
        <SiteNav />
        <div className="alert alert-error">{error}</div>
      </main>
    );
  }

  if (!profileUser || !profile) {
    return null;
  }

  return (
    <main className="main-wide">
      <SiteNav />
      <header className="page-header section-header">
        <div>
          <h1>{profile.displayName}</h1>
          <p className="text-muted">@{profileUser.username}</p>
          {profile.bio && <p>{profile.bio}</p>}
          <p className="text-muted" style={{ marginTop: 8 }}>
            <Link href={`/users/${userId}/followers`} data-testid="profile-followers-link">
              粉丝
            </Link>
            {' · '}
            <Link href={`/users/${userId}/following`} data-testid="profile-following-link">
              关注
            </Link>
          </p>
        </div>
        {!isSelf && followKnown && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={messagePending}
              onClick={() => void handleMessage()}
            >
              {messagePending ? '打开中…' : '发消息'}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
              disabled={followPending}
              onClick={() => void handleToggleFollow()}
            >
              {isFollowing ? '已关注' : '关注'}
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <h2 className="section-title">动态</h2>
      {posts.length === 0 ? (
        <div className="card empty-state">
          <p className="text-muted">还没有动态。</p>
        </div>
      ) : (
        <div className="post-list">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={viewer?.id ?? null}
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
            {isLoadingMore ? '加载中…' : '加载更多'}
          </button>
        </div>
      )}

      <p className="text-muted" style={{ marginTop: 16 }}>
        <Link href="/feed">返回动态广场</Link>
      </p>
    </main>
  );
}
