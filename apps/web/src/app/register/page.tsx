'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { isValidPassword } from '@orbitchat/shared-utils';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { ApiError } from '@/lib/api/errors';
import { login as apiLogin } from '@/lib/api/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { register, setAuthFromLogin } = useAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!isValidPassword(password)) {
      setError(t('auth.passwordPolicyError'));
      setIsSubmitting(false);
      return;
    }

    try {
      await register({
        username,
        email,
        password,
        displayName,
      });
      const loginResult = await apiLogin({
        email,
        password,
        trustDevice,
      });
      setAuthFromLogin(loginResult);
      if (loginResult.user.emailVerifiedAt === null) {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('orbitchat.verifyPending', '1');
        }
        router.push('/profile');
        return;
      }
      router.push('/profile');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.message
            ? t('auth.registerFailedPrefix', { message: err.message })
            : t('auth.registerFailedInvalid')
        );
      } else {
        setError(t('auth.registerFailedRetry'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <h1>{t('auth.registerTitle')}</h1>
        <p>{t('auth.registerDescription')}</p>
      </header>

      <div className="card">
        <form className="form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label htmlFor="username">{t('auth.username')}</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_]+"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="displayName">{t('auth.displayName')}</label>
            <input
              id="displayName"
              type="text"
              required
              maxLength={128}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>

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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <span className="text-muted">
              {t('auth.passwordHint')}
            </span>
          </div>

          <label className="field-checkbox">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(event) => setTrustDevice(event.target.checked)}
            />
            {t('auth.trustDevice')}
          </label>

          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? t('auth.creatingAccount') : t('auth.createAccount')}
          </button>
        </form>

        <p className="text-muted" style={{ marginTop: 16 }}>
          {t('auth.hasAccount')} <Link href="/login">{t('auth.goLogin')}</Link>
        </p>
      </div>
    </main>
  );
}
