'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/errors';
import { DEV_TEST_USER, isDevLoginShortcutsEnabled } from '@/lib/dev-test-user';

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
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDevTestLogin() {
    setEmail(DEV_TEST_USER.email);
    setPassword(DEV_TEST_USER.password);
    setRememberMe(true);
    setTrustDevice(true);
    await submitLogin(DEV_TEST_USER.email, DEV_TEST_USER.password);
  }

  return (
    <>
      {registered && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>
          Account created. Please sign in.
        </div>
      )}

      <form className="form" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
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
          <label htmlFor="password">Password</label>
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
          Keep me signed in
        </label>

        <label className="field-checkbox">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(event) => setTrustDevice(event.target.checked)}
          />
          Trust this device
        </label>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {isDevLoginShortcutsEnabled() && (
        <div className="dev-login-shortcuts" data-testid="dev-login-shortcuts">
          <p className="text-muted" style={{ marginTop: 16, marginBottom: 8 }}>
            Dev only — local test account
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            data-testid="dev-login-test-user"
            disabled={isSubmitting}
            onClick={() => void handleDevTestLogin()}
          >
            Login as {DEV_TEST_USER.username} ({DEV_TEST_USER.email})
          </button>
        </div>
      )}
    </>
  );
}
