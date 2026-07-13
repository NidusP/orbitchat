'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/feed');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || isAuthenticated) {
    return (
      <main>
        <p className="text-muted">{t('common.loading')}</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <header className="page-header">
        <h1>{t('landing.title')}</h1>
        <p>{t('landing.subtitle')}</p>
      </header>

      <div className="card">
        <p>{t('landing.description')}</p>
        <div className="nav" style={{ marginTop: 16, marginBottom: 0 }}>
          <Link href="/register" className="btn btn-primary">
            {t('landing.register')}
          </Link>
          <Link href="/login" className="btn btn-secondary">
            {t('landing.login')}
          </Link>
        </div>
      </div>
    </main>
  );
}
