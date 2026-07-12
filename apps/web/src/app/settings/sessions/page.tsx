'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { UserSession } from '@orbitchat/shared-types';
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
      setError(err instanceof ApiError ? `加载会话失败：${err.message}` : '加载会话失败。');
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
      setSuccess(trust ? '当前设备已设为受信任。' : '已取消当前设备的信任。');
      await loadSessions();
    } catch (err) {
      setError(err instanceof ApiError ? `更新信任状态失败：${err.message}` : '更新信任状态失败。');
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

      setSuccess('会话已撤销。');
      await loadSessions();
    } catch (err) {
      setError(err instanceof ApiError ? `撤销会话失败：${err.message}` : '撤销会话失败。');
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
      setSuccess(`已登出其他 ${data.revokedCount} 台设备。`);
      await loadSessions();
    } catch (err) {
      setError(
        err instanceof ApiError ? `登出其他设备失败：${err.message}` : '登出其他设备失败。'
      );
    } finally {
      setActionId(null);
    }
  }

  if (isLoading || !user || !session) {
    return (
      <main>
        <p className="text-muted">加载中…</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <header className="page-header">
        <h1>会话管理</h1>
        <p>管理已登录你账号的设备。</p>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <h2 className="section-title">当前设备</h2>
        <dl className="session-meta">
          <dt>平台</dt>
          <dd>{session.platform}</dd>
          <dt>设备</dt>
          <dd>{sessionLabel(session)}</dd>
          <dt>受信任</dt>
          <dd>{session.isTrusted ? '是' : '否'}</dd>
          <dt>最近活跃</dt>
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
              {actionId === 'trust' ? '更新中…' : '信任此设备'}
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
              {actionId === 'trust' ? '更新中…' : '取消信任此设备'}
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
            {actionId === session.id ? '登出中…' : '登出当前设备'}
          </button>
        </div>
      </div>

      {!isTrusted && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="text-muted">
            将当前设备设为受信任后，可查看全部活跃会话并登出其他设备。你也可以在登录时开启该选项。
          </p>
        </div>
      )}

      {isTrusted && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-header">
            <h2 className="section-title">全部会话</h2>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={actionId !== null || sessions.length <= 1}
              onClick={() => {
                void handleLogoutAll();
              }}
            >
              {actionId === 'logout-all' ? '登出中…' : '登出其他全部设备'}
            </button>
          </div>

          {pageLoading ? (
            <p className="text-muted">会话加载中…</p>
          ) : sessions.length === 0 ? (
            <p className="text-muted">暂无活跃会话。</p>
          ) : (
            <ul className="session-list">
              {sessions.map((item) => {
                const isCurrent = item.id === currentSessionId;

                return (
                  <li key={item.id} className="session-item">
                    <div>
                      <strong>{sessionLabel(item)}</strong>
                      <span className="text-muted"> · {item.platform}</span>
                      {isCurrent && <span className="badge badge-current">当前设备</span>}
                      {item.isTrusted && <span className="badge badge-trusted">受信任</span>}
                      <p className="text-muted session-item-meta">
                        最近活跃 {formatWhen(item.lastActiveAt)} · 过期时间 {formatWhen(item.expiresAt)}
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
                        {actionId === item.id ? '撤销中…' : '撤销'}
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
        <Link href="/settings">返回设置</Link>
        {' · '}
        <Link href="/profile">返回我的</Link>
      </p>
    </main>
  );
}
