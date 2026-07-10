'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { GroupInvitePreview } from '@orbitchat/shared-types';
import { SiteNav } from '@/components/site-nav';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/errors';
import { acceptGroupInvite, getGroupInvitePreview } from '@/lib/api/conversations';

export default function InviteJoinPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [preview, setPreview] = useState<GroupInvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getGroupInvitePreview(code);
        setPreview(result);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load invite.');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [code, isAuthenticated]);

  async function handleJoin(): Promise<void> {
    setIsJoining(true);
    setError(null);
    try {
      await acceptGroupInvite(code);
      if (preview) {
        router.replace(`/messages/${preview.conversationId}`);
      } else {
        router.replace('/messages');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to join group.');
      setIsJoining(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <main className="main-wide">
        <SiteNav />
        <p className="text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <SiteNav />
      <header className="page-header section-header">
        <h1>Group invite</h1>
      </header>
      {error && <div className="alert alert-error">{error}</div>}
      {preview && (
        <section className="card form-stack">
          <h2 style={{ margin: 0, fontSize: '1.125rem' }}>{preview.groupTitle}</h2>
          <p className="text-muted">Members: {preview.memberCount}</p>
          {!preview.isActive && <p className="text-muted">This invite is expired or revoked.</p>}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!preview.isActive || isJoining}
            onClick={() => void handleJoin()}
          >
            {isJoining ? 'Joining...' : 'Join group'}
          </button>
        </section>
      )}
    </main>
  );
}
