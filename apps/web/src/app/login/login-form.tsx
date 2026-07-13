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
import { useI18n } from '@/contexts/i18n-context';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered') === '1';
  const { login } = useAuth();
  const { t } = useI18n();
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
        setError(
          err.message
            ? t('auth.loginFailedPrefix', { message: err.message })
            : t('auth.loginFailedInvalid')
        );
      } else {
        setError(t('auth.loginFailedRetry'));
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
          {t('auth.registerSuccess')}
        </div>
      )}

      <form className="form" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">{t('auth.email')}</label>
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
          <label htmlFor="password">{t('auth.password')}</label>
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
          {t('auth.rememberMe')}
        </label>

        <label className="field-checkbox">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(event) => setTrustDevice(event.target.checked)}
          />
          {t('auth.trustDevice')}
        </label>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? t('auth.loggingIn') : t('auth.login')}
        </button>
      </form>

      {showDevLoginShortcuts && (
        <div className="dev-login-shortcuts" data-testid="dev-login-shortcuts">
          <p className="text-muted" style={{ marginTop: 16, marginBottom: 8 }}>
            {t('auth.devLoginShortcuts')}
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
                {t('auth.devLoginTemplate', {
                  username: fixture.username,
                  email: fixture.email,
                })}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
