'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { UserSession } from '@orbitchat/shared-types';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { ApiError } from '@/lib/api/errors';
import { listSessions, logoutAll, revokeSession, trustSession } from '@/lib/api/auth';
import { clearAccessToken } from '@/lib/api/client';

function formatWhen(iso: string, locale: 'zh' | 'en'): string {
  return new Date(iso).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
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
  const { t, locale } = useI18n();
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
      setError(
        err instanceof ApiError
          ? t('sessions.errors.loadWithMessage', { message: err.message })
          : t('sessions.errors.load')
      );
    } finally {
      setPageLoading(false);
    }
  }, [isTrusted, session?.id, t]);

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
      setSuccess(trust ? t('sessions.success.trusted') : t('sessions.success.untrusted'));
      await loadSessions();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? t('sessions.errors.trustWithMessage', { message: err.message })
          : t('sessions.errors.trust')
      );
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

      setSuccess(t('sessions.success.revoked'));
      await loadSessions();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? t('sessions.errors.revokeWithMessage', { message: err.message })
          : t('sessions.errors.revoke')
      );
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
      setSuccess(t('sessions.success.logoutOthers', { count: data.revokedCount }));
      await loadSessions();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? t('sessions.errors.logoutAllWithMessage', { message: err.message })
          : t('sessions.errors.logoutAll')
      );
    } finally {
      setActionId(null);
    }
  }

  if (isLoading || !user || !session) {
    return (
      <main>
        <p className="text-muted">{t('sessions.loading')}</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <header className="page-header">
        <h1>{t('sessions.title')}</h1>
        <p>{t('sessions.description')}</p>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <h2 className="section-title">{t('sessions.sections.currentDevice')}</h2>
        <dl className="session-meta">
          <dt>{t('sessions.fields.platform')}</dt>
          <dd>{session.platform}</dd>
          <dt>{t('sessions.fields.device')}</dt>
          <dd>{sessionLabel(session)}</dd>
          <dt>{t('sessions.fields.trusted')}</dt>
          <dd>{session.isTrusted ? t('sessions.trustedYes') : t('sessions.trustedNo')}</dd>
          <dt>{t('sessions.fields.lastActive')}</dt>
          <dd>{formatWhen(session.lastActiveAt, locale)}</dd>
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
              {actionId === 'trust' ? t('sessions.actions.updating') : t('sessions.actions.trustDevice')}
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
              {actionId === 'trust' ? t('sessions.actions.updating') : t('sessions.actions.untrustDevice')}
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
            {actionId === session.id ? t('sessions.actions.loggingOut') : t('sessions.actions.logoutCurrent')}
          </button>
        </div>
      </div>

      {!isTrusted && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="text-muted">
            {t('sessions.hints.trustToViewAll')}
          </p>
        </div>
      )}

      {isTrusted && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-header">
            <h2 className="section-title">{t('sessions.sections.allSessions')}</h2>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={actionId !== null || sessions.length <= 1}
              onClick={() => {
                void handleLogoutAll();
              }}
            >
              {actionId === 'logout-all' ? t('sessions.actions.loggingOut') : t('sessions.actions.logoutOthers')}
            </button>
          </div>

          {pageLoading ? (
            <p className="text-muted">{t('sessions.states.loadingList')}</p>
          ) : sessions.length === 0 ? (
            <p className="text-muted">{t('sessions.states.empty')}</p>
          ) : (
            <ul className="session-list">
              {sessions.map((item) => {
                const isCurrent = item.id === currentSessionId;

                return (
                  <li key={item.id} className="session-item">
                    <div>
                      <strong>{sessionLabel(item)}</strong>
                      <span className="text-muted"> · {item.platform}</span>
                      {isCurrent && <span className="badge badge-current">{t('sessions.badges.current')}</span>}
                      {item.isTrusted && <span className="badge badge-trusted">{t('sessions.badges.trusted')}</span>}
                      <p className="text-muted session-item-meta">
                        {t('sessions.itemMeta', {
                          lastActive: formatWhen(item.lastActiveAt, locale),
                          expiresAt: formatWhen(item.expiresAt, locale),
                        })}
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
                        {actionId === item.id ? t('sessions.actions.revoking') : t('sessions.actions.revoke')}
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
        <Link href="/settings">{t('sessions.links.backSettings')}</Link>
        {' · '}
        <Link href="/profile">{t('sessions.links.backProfile')}</Link>
      </p>
    </main>
  );
}
