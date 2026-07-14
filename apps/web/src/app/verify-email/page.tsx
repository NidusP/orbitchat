'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { verifyEmail, resendVerification } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/errors';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, refreshUser } = useAuth();
  const { t } = useI18n();
  const [token, setToken] = useState(() => searchParams.get('token') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await verifyEmail({ token: token.trim() });
      if (isAuthenticated) {
        await refreshUser();
      }
      setSuccess(t('auth.verifyEmail.success'));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? t('auth.verifyEmail.failedWithMessage', { message: err.message })
          : t('auth.verifyEmail.failed')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend(): Promise<void> {
    setError(null);
    setSuccess(null);
    setIsResending(true);

    try {
      await resendVerification();
      setSuccess(t('auth.verifyEmail.resendSuccess'));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? t('auth.verifyEmail.resendFailedWithMessage', { message: err.message })
          : t('auth.verifyEmail.resendFailed')
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <h1>{t('auth.verifyEmail.title')}</h1>
        <p>{t('auth.verifyEmail.description')}</p>
      </header>

      <div className="card">
        <form className="form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="field">
            <label htmlFor="token">{t('auth.verifyEmail.tokenLabel')}</label>
            <input
              id="token"
              type="text"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? t('auth.verifyEmail.submitting') : t('auth.verifyEmail.submit')}
          </button>
        </form>

        {!isLoading && isAuthenticated && (
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isResending}
              onClick={() => {
                void handleResend();
              }}
            >
              {isResending ? t('auth.verifyEmail.resending') : t('auth.verifyEmail.resend')}
            </button>
          </div>
        )}

        <p className="text-muted" style={{ marginTop: 16 }}>
          <Link href={isAuthenticated ? '/profile' : '/login'}>
            {isAuthenticated ? t('auth.verifyEmail.backToProfile') : t('auth.goLogin')}
          </Link>
          {isAuthenticated && (
            <>
              {' · '}
              <Link href="/feed">{t('auth.verifyEmail.backToFeed')}</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  const { t } = useI18n();

  return (
    <Suspense fallback={<main><p className="text-muted">{t('common.loading')}</p></main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
