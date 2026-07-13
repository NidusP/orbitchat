'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import type { UserSearchResult } from '@orbitchat/shared-types';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { ApiError } from '@/lib/api/errors';
import { createGroupConversation } from '@/lib/api/conversations';
import { searchUsers } from '@/lib/api/social';

export default function NewGroupPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
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
      setError(err instanceof ApiError ? err.message : t('groupNew.errors.search'));
    } finally {
      setIsSearching(false);
    }
  }, [query, t]);

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
      setError(err instanceof ApiError ? err.message : t('groupNew.errors.create'));
      setIsSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <main className="main-wide">
        <p className="text-muted">{t('groupNew.loading')}</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <header className="page-header section-header">
        <h1>{t('groupNew.title')}</h1>
        <Link href="/messages" className="btn btn-secondary">
          {t('groupNew.back')}
        </Link>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="card form-stack" onSubmit={(event) => void handleSubmit(event)}>
        <label className="form-field">
          <span>{t('groupNew.labels.groupName')}</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
            placeholder={t('groupNew.placeholders.groupName')}
          />
        </label>

        <div className="form-field">
          <span>{t('groupNew.labels.addMembers')}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('groupNew.placeholders.searchByUsername')}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => void runSearch()}>
              {isSearching ? t('groupNew.actions.searching') : t('groupNew.actions.search')}
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
                    <span className="text-muted">
                      {isSelected ? t('groupNew.actions.selected') : t('groupNew.actions.add')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selected.length > 0 && (
          <p className="text-muted">
            {t('groupNew.selectedPrefix')} {selected.map((user) => user.displayName).join(', ')}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting || title.trim().length === 0 || selected.length === 0}
        >
          {isSubmitting ? t('groupNew.actions.creating') : t('groupNew.actions.create')}
        </button>
      </form>
    </main>
  );
}
