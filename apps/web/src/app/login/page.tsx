import Link from 'next/link';
import { Suspense } from 'react';
import { SiteNav } from '@/components/site-nav';
import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <main>
      <SiteNav />
      <header className="page-header">
        <h1>Login</h1>
        <p>Sign in to your Orbitchat account.</p>
      </header>

      <div className="card">
        <Suspense fallback={<p className="text-muted">Loading…</p>}>
          <LoginForm />
        </Suspense>

        <p className="text-muted" style={{ marginTop: 16 }}>
          No account? <Link href="/register">Register</Link>
        </p>
      </div>
    </main>
  );
}
