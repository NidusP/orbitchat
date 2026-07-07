'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import type { UserSearchResult } from '@orbitchat/shared-types';
import { SiteNav } from '@/components/site-nav';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/errors';
import { createGroupConversation } from '@/lib/api/conversations';
import { searchUsers } from '@/lib/api/social';

export default function NewGroupPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selected, setSelected] = useState<UserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const page = await searchUsers(trimmed, { limit: 8 });
      setSearchResults(page.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed.');
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  function toggleMember(user: UserSearchResult): void {
    setSelected((current) => {
      const exists = current.some((item) => item.id === user.id);
      if (exists) {
        return current.filter((item) => item.id !== user.id);
      }
      return [...current, user];
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const conversation = await createGroupConversation({
        type: 'group',
        title: title.trim(),
        memberUserIds: selected.map((user) => user.id),
      });
      router.push(`/messages/${conversation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create group.');
      setIsSubmitting(false);
    }
  }

  if (authLoading) {
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
        <h1>New group</h1>
        <Link href="/messages" className="btn btn-secondary">
          Back
        </Link>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="card form-stack" onSubmit={(event) => void handleSubmit(event)}>
        <label className="form-field">
          <span>Group name</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
            placeholder="Weekend crew"
          />
        </label>

        <div className="form-field">
          <span>Add members</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by username"
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => void runSearch()}>
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>

        {searchResults.length > 0 && (
          <ul className="conversation-list">
            {searchResults.map((user) => {
              const isSelected = selected.some((item) => item.id === user.id);
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    className="conversation-list-item"
                    onClick={() => toggleMember(user)}
                    style={{ width: '100%', textAlign: 'left' }}
                  >
                    <span className="conversation-list-title">
                      {user.displayName} (@{user.username})
                    </span>
                    <span className="text-muted">{isSelected ? 'Selected' : 'Add'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selected.length > 0 && (
          <p className="text-muted">
            Selected: {selected.map((user) => user.displayName).join(', ')}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting || title.trim().length === 0 || selected.length === 0}
        >
          {isSubmitting ? 'Creating…' : 'Create group'}
        </button>
      </form>
    </main>
  );
}
