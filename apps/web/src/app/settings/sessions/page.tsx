'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { UserSession } from '@orbitchat/shared-types';
import { SiteNav } from '@/components/site-nav';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/errors';
import { listSessions, logoutAll, revokeSession, trustSession } from '@/lib/api/auth';
import { clearAccessToken } from '@/lib/api/client';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

function sessionLabel(item: UserSession): string {
  if (item.deviceName) {
    return item.deviceName;
  }

  return `${item.deviceId.slice(0, 8)}…`;
}

export default function SessionsPage() {
  const router = useRouter();
  const { user, session, isAuthenticated, isLoading, setSessionState, logout: clearAuthState } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isTrusted = session?.isTrusted ?? false;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const loadSessions = useCallback(async () => {
    if (!isTrusted) {
      setSessions([]);
      setCurrentSessionId(session?.id ?? null);
      setPageLoading(false);
      return;
    }

    setPageLoading(true);
    setError(null);

    try {
      const data = await listSessions();
      setSessions(data.sessions);
      setCurrentSessionId(data.currentSessionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load sessions.');
    } finally {
      setPageLoading(false);
    }
  }, [isTrusted, session?.id]);

  useEffect(() => {
    if (!session || !isAuthenticated) {
      return;
    }

    void loadSessions();
  }, [session, isAuthenticated, loadSessions]);

  async function handleTrustDevice(trust: boolean) {
    setError(null);
    setSuccess(null);
    setActionId('trust');

    try {
      const data = await trustSession({ trust });
      setSessionState(data.session);
      setSuccess(trust ? 'This device is now trusted.' : 'Trust removed from this device.');
      await loadSessions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update trust.');
    } finally {
      setActionId(null);
    }
  }

  async function handleRevoke(targetSessionId: string) {
    setError(null);
    setSuccess(null);
    setActionId(targetSessionId);

    try {
      await revokeSession(targetSessionId);

      if (targetSessionId === session?.id) {
        clearAccessToken();
        await clearAuthState();
        router.replace('/login');
        return;
      }

      setSuccess('Session revoked.');
      await loadSessions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke session.');
    } finally {
      setActionId(null);
    }
  }

  async function handleLogoutAll() {
    setError(null);
    setSuccess(null);
    setActionId('logout-all');

    try {
      const data = await logoutAll();
      setSuccess(`Signed out ${data.revokedCount} other device(s).`);
      await loadSessions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to sign out other devices.');
    } finally {
      setActionId(null);
    }
  }

  if (isLoading || !user || !session) {
    return (
      <main>
        <SiteNav />
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <SiteNav />
      <header className="page-header">
        <h1>Sessions</h1>
        <p>Manage devices signed in to your account.</p>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <h2 className="section-title">This device</h2>
        <dl className="session-meta">
          <dt>Platform</dt>
          <dd>{session.platform}</dd>
          <dt>Device</dt>
          <dd>{sessionLabel(session)}</dd>
          <dt>Trusted</dt>
          <dd>{session.isTrusted ? 'Yes' : 'No'}</dd>
          <dt>Last active</dt>
          <dd>{formatWhen(session.lastActiveAt)}</dd>
        </dl>

        <div className="stack" style={{ marginTop: 16 }}>
          {!session.isTrusted ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={actionId !== null}
              onClick={() => {
                void handleTrustDevice(true);
              }}
            >
              {actionId === 'trust' ? 'Updating…' : 'Trust this device'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={actionId !== null}
              onClick={() => {
                void handleTrustDevice(false);
              }}
            >
              {actionId === 'trust' ? 'Updating…' : 'Remove trust from this device'}
            </button>
          )}

          <button
            type="button"
            className="btn btn-danger"
            disabled={actionId !== null}
            onClick={() => {
              void handleRevoke(session.id);
            }}
          >
            {actionId === session.id ? 'Signing out…' : 'Sign out this device'}
          </button>
        </div>
      </div>

      {!isTrusted && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="text-muted">
            Trust this device to view all active sessions and sign out other devices. You can also
            enable trust when signing in.
          </p>
        </div>
      )}

      {isTrusted && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-header">
            <h2 className="section-title">All sessions</h2>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={actionId !== null || sessions.length <= 1}
              onClick={() => {
                void handleLogoutAll();
              }}
            >
              {actionId === 'logout-all' ? 'Signing out…' : 'Sign out all other devices'}
            </button>
          </div>

          {pageLoading ? (
            <p className="text-muted">Loading sessions…</p>
          ) : sessions.length === 0 ? (
            <p className="text-muted">No active sessions.</p>
          ) : (
            <ul className="session-list">
              {sessions.map((item) => {
                const isCurrent = item.id === currentSessionId;

                return (
                  <li key={item.id} className="session-item">
                    <div>
                      <strong>{sessionLabel(item)}</strong>
                      <span className="text-muted"> · {item.platform}</span>
                      {isCurrent && <span className="badge badge-current">This device</span>}
                      {item.isTrusted && <span className="badge badge-trusted">Trusted</span>}
                      <p className="text-muted session-item-meta">
                        Last active {formatWhen(item.lastActiveAt)} · Expires {formatWhen(item.expiresAt)}
                      </p>
                    </div>
                    {!isCurrent && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={actionId !== null}
                        onClick={() => {
                          void handleRevoke(item.id);
                        }}
                      >
                        {actionId === item.id ? 'Revoking…' : 'Revoke'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <p className="text-muted" style={{ marginTop: 16 }}>
        <Link href="/profile">Back to profile</Link>
      </p>
    </main>
  );
}
