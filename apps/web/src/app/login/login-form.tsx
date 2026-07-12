'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/errors';
import {
  DEV_TEST_USERS,
  type DevTestUserFixture,
  isDevLoginShortcutsEnabled,
} from '@/lib/dev-test-user';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered') === '1';
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showDevLoginShortcuts =
    process.env.NODE_ENV === 'development' && isDevLoginShortcutsEnabled();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitLogin(email, password);
  }

  async function submitLogin(loginEmail: string, loginPassword: string) {
    setError(null);
    setIsSubmitting(true);

    try {
      await login({
        email: loginEmail,
        password: loginPassword,
        rememberMe,
        trustDevice,
      });
      router.push('/profile');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message ? `登录失败：${err.message}` : '登录失败，请检查邮箱和密码。');
      } else {
        setError('登录失败，请稍后重试。');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDevTestLogin(fixture: DevTestUserFixture) {
    setEmail(fixture.email);
    setPassword(fixture.password);
    setRememberMe(true);
    setTrustDevice(true);
    await submitLogin(fixture.email, fixture.password);
  }

  return (
    <>
      {registered && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>
          账号创建成功，请登录。
        </div>
      )}

      <form className="form" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">邮箱</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">密码</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <label className="field-checkbox">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          保持登录状态
        </label>

        <label className="field-checkbox">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(event) => setTrustDevice(event.target.checked)}
          />
          信任此设备
        </label>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? '登录中…' : '登录'}
        </button>
      </form>

      {showDevLoginShortcuts && (
        <div className="dev-login-shortcuts" data-testid="dev-login-shortcuts">
          <p className="text-muted" style={{ marginTop: 16, marginBottom: 8 }}>
            仅开发环境：一键登录测试账号
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEV_TEST_USERS.map((fixture, index) => (
              <button
                key={fixture.email}
                type="button"
                className="btn btn-secondary btn-sm"
                data-testid={`dev-login-test-user-${index + 1}`}
                disabled={isSubmitting}
                onClick={() => void handleDevTestLogin(fixture)}
              >
                使用 {fixture.username} 登录（{fixture.email}）
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
