'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { UserSearchResult } from '@orbitchat/shared-types';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/errors';
import { followUser, getFollowers, getFollowing, unfollowUser } from '@/lib/api/social';
import { getProfile, getUser } from '@/lib/api/users';

type ConnectionMode = 'followers' | 'following';

interface UserConnectionListProps {
  userId: string;
  mode: ConnectionMode;
}

const MODE_COPY: Record<ConnectionMode, { title: string; empty: string }> = {
  followers: { title: 'Followers', empty: 'No followers yet.' },
  following: { title: 'Following', empty: 'Not following anyone yet.' },
};

export function UserConnectionList({ userId, mode }: UserConnectionListProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user: viewer } = useAuth();
  const copy = MODE_COPY[mode];

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [items, setItems] = useState<UserSearchResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (cursor?: string) => {
      const loader = mode === 'followers' ? getFollowers : getFollowing;
      return loader(userId, { cursor, limit: 20 });
    },
    [mode, userId]
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoadingPage(true);
      setError(null);

      try {
        const [userRecord, profileRecord, page] = await Promise.all([
          getUser(userId),
          getProfile(userId),
          fetchPage(),
        ]);

        if (cancelled) {
          return;
        }

        setUsername(userRecord.username);
        setDisplayName(profileRecord.displayName);
        setItems(page.items);
        setNextCursor(page.nextCursor);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load list.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPage(false);
        }
      }
    }

    if (isAuthenticated) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [userId, fetchPage, isAuthenticated]);

  async function handleLoadMore() {
    if (!nextCursor) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      const page = await fetchPage(nextCursor);
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load more.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleToggleFollow(target: UserSearchResult) {
    if (!viewer || viewer.id === target.id) {
      return;
    }

    const isFollowing = followingIds.has(target.id);
    setPendingId(target.id);

    try {
      if (isFollowing) {
        await unfollowUser(target.id);
        setFollowingIds((current) => {
          const next = new Set(current);
          next.delete(target.id);
          return next;
        });
      } else {
        await followUser(target.id);
        setFollowingIds((current) => new Set(current).add(target.id));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update follow.');
    } finally {
      setPendingId(null);
    }
  }

  if (isLoading || isLoadingPage || !viewer) {
    return (
      <main className="main-wide">
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  if (error && !displayName) {
    return (
      <main className="main-wide">
        <div className="alert alert-error">{error}</div>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <header className="page-header">
        <h1>{copy.title}</h1>
        {displayName && username && (
          <p className="text-muted">
            {displayName} (@{username})
          </p>
        )}
      </header>

      <p className="text-muted" style={{ marginBottom: 16 }}>
        <Link href={`/users/${userId}`}>Back to profile</Link>
        {' · '}
        <Link href={`/users/${userId}/followers`}>Followers</Link>
        {' · '}
        <Link href={`/users/${userId}/following`}>Following</Link>
      </p>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card empty-state">
          <p className="text-muted">{copy.empty}</p>
        </div>
      ) : (
        <ul className="user-result-list" data-testid={`user-${mode}-list`}>
          {items.map((item) => {
            const isSelf = item.id === viewer.id;
            const isFollowing = followingIds.has(item.id);

            return (
              <li key={item.id} className="user-result-item" data-testid={`user-${mode}-item-${item.id}`}>
                <div>
                  <Link href={`/users/${item.id}`}>
                    <strong>{item.displayName}</strong>
                  </Link>
                  <p className="text-muted">@{item.username}</p>
                </div>
                {!isSelf && (
                  <button
                    type="button"
                    className={`btn btn-sm ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                    data-testid={`follow-button-${item.id}`}
                    disabled={pendingId === item.id}
                    onClick={() => void handleToggleFollow(item)}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor && (
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid={`user-${mode}-load-more`}
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
