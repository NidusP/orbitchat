'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import {
  createAiMemory,
  deleteAiMemory,
  listAiMemories,
  type UserAgentMemory,
  type UserAgentMemoryKind,
} from '@/lib/api/ai';
import { ApiError } from '@/lib/api/errors';

const MEMORY_KINDS: UserAgentMemoryKind[] = ['preference', 'fact', 'nickname'];

function formatMemoryDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString();
}

function sortMemories(items: UserAgentMemory[]): UserAgentMemory[] {
  return [...items].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
  );
}

export default function AiMemoriesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const [memories, setMemories] = useState<UserAgentMemory[]>([]);
  const [kind, setKind] = useState<UserAgentMemoryKind>('preference');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const kindLabel = useCallback(
    (kind: UserAgentMemoryKind): string => {
      switch (kind) {
        case 'preference':
          return t('memories.kinds.preference');
        case 'fact':
          return t('memories.kinds.fact');
        case 'nickname':
          return t('memories.kinds.nickname');
      }
    },
    [t]
  );

  const loadMemories = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const memories = await listAiMemories({ limit: 50 });
      setMemories(sortMemories(memories));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('memories.errors.load'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void loadMemories();
  }, [isAuthenticated, loadMemories]);

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || isCreating) {
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const created = await createAiMemory({ kind, content: trimmed });
      setMemories((current) => sortMemories([created, ...current]));
      setContent('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('memories.errors.add'));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (deletingId) {
      return;
    }

    setDeletingId(id);
    setError(null);
    try {
      await deleteAiMemory(id);
      setMemories((current) => current.filter((memory) => memory.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('memories.errors.delete'));
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading || isLoading) {
    return (
      <main className="main-wide">
        <p className="text-muted">{t('memories.loading')}</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <header className="page-header section-header">
        <div>
          <h1>{t('memories.title')}</h1>
          <p className="text-muted">{t('memories.subtitle')}</p>
        </div>
        <Link href="/ai" className="btn btn-secondary btn-sm">
          {t('memories.backToAi')}
        </Link>
      </header>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <section className="card form-stack" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{t('memories.sections.add')}</h2>
        <form onSubmit={(event) => void handleCreate(event)}>
          <label className="form-field">
            {t('memories.labels.kind')}
            <select
              className="chat-select"
              value={kind}
              onChange={(event) => setKind(event.target.value as UserAgentMemoryKind)}
            >
              {MEMORY_KINDS.map((option) => (
                <option key={option} value={option}>
                  {kindLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            {t('memories.labels.content')}
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder={t('memories.placeholder')}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={isCreating || !content.trim()}>
            {isCreating ? t('memories.actions.saving') : t('memories.actions.add')}
          </button>
        </form>
      </section>

      <section className="card form-stack">
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>
          {t('memories.sections.list', { count: memories.length })}
        </h2>
        {memories.length === 0 ? (
          <p className="text-muted">{t('memories.empty')}</p>
        ) : (
          <ul className="conversation-list">
            {memories.map((memory) => (
              <li key={memory.id} className="conversation-list-item">
                <div className="conversation-list-main">
                  <span className="conversation-list-title">{kindLabel(memory.kind)}</span>
                  <time className="conversation-list-time" dateTime={memory.createdAt}>
                    {formatMemoryDate(memory.createdAt)}
                  </time>
                </div>
                <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{memory.content}</p>
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={deletingId === memory.id}
                    onClick={() => void handleDelete(memory.id)}
                  >
                    {deletingId === memory.id ? t('memories.actions.deleting') : t('memories.actions.delete')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
