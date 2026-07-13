'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useI18n } from '@/contexts/i18n-context';
import LoginForm from './login-form';

export default function LoginPage() {
  const { t } = useI18n();

  return (
    <main>
      <header className="page-header">
        <h1>{t('auth.loginTitle')}</h1>
        <p>{t('auth.loginDescription')}</p>
      </header>

      <div className="card">
        <Suspense fallback={<p className="text-muted">{t('common.loading')}</p>}>
          <LoginForm />
        </Suspense>

        <p className="text-muted" style={{ marginTop: 16 }}>
          {t('auth.noAccount')} <Link href="/register">{t('auth.registerNow')}</Link>
        </p>
      </div>
    </main>
  );
}
