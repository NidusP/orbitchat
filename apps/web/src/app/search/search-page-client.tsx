'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { UserSearchResult } from '@orbitchat/shared-types';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { ApiError } from '@/lib/api/errors';
import { followUser, searchUsers, unfollowUser } from '@/lib/api/social';

export function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useI18n();

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const runSearch = useCallback(async (term: string, cursor?: string) => {
    if (term.trim() === '') {
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const page = await searchUsers(term.trim(), { cursor, limit: 20 });
      setResults((current) => (cursor ? [...current, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? t('search.errors.searchWithMessage', { message: err.message })
          : t('search.errors.search')
      );
    } finally {
      setIsSearching(false);
    }
  }, [t]);

  useEffect(() => {
    if (initialQuery.trim() !== '') {
      void runSearch(initialQuery);
    }
  }, [initialQuery, runSearch]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term === '') {
      return;
    }

    router.replace(`/search?q=${encodeURIComponent(term)}`);
    await runSearch(term);
  }

  async function handleToggleFollow(target: UserSearchResult) {
    if (!user || user.id === target.id) {
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
      setError(
        err instanceof ApiError
          ? t('search.errors.followWithMessage', { message: err.message })
          : t('search.errors.follow')
      );
    } finally {
      setPendingId(null);
    }
  }

  if (isLoading || !isAuthenticated || !user) {
    return (
      <main className="main-wide">
        <p className="text-muted">{t('search.loading')}</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <header className="page-header">
        <h1>{t('search.title')}</h1>
        <p className="text-muted">{t('search.subtitle')}</p>
      </header>

      <div className="card">
        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="search-q">{t('search.keyword')}</label>
            <input
              id="search-q"
              type="search"
              data-testid="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('search.placeholder')}
              maxLength={64}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            data-testid="search-submit"
            disabled={isSearching || query.trim() === ''}
          >
            {isSearching ? t('search.actions.searching') : t('search.actions.search')}
          </button>
        </form>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {results.length > 0 && (
        <ul className="user-result-list">
          {results.map((result) => {
            const isSelf = result.id === user.id;
            const isFollowing = followingIds.has(result.id);

            return (
              <li key={result.id} className="user-result-item">
                <div className="user-result-main">
                  <UserAvatar
                    displayName={result.displayName}
                    userId={result.id}
                    avatarUrl={result.avatarUrl}
                    size="md"
                  />
                  <div className="user-result-meta">
                    <Link href={`/users/${result.id}`}>
                      <strong>{result.displayName}</strong>
                    </Link>
                    <p className="text-muted">@{result.username}</p>
                  </div>
                </div>
                {!isSelf && (
                  <button
                    type="button"
                    className={`btn btn-sm ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                    data-testid={`follow-button-${result.id}`}
                    disabled={pendingId === result.id}
                    onClick={() => void handleToggleFollow(result)}
                  >
                    {isFollowing ? t('search.actions.following') : t('search.actions.follow')}
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
            disabled={isSearching}
            onClick={() => void runSearch(query, nextCursor)}
          >
            {t('search.actions.loadMore')}
          </button>
        </div>
      )}
    </main>
  );
}
