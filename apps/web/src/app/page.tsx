import Link from 'next/link';
import { SiteNav } from '@/components/site-nav';

export default function Home() {
  return (
    <main>
      <SiteNav />
      <header className="page-header">
        <h1>Orbitchat</h1>
        <p>A learning project for modern full-stack TypeScript development.</p>
      </header>

      <div className="card">
        <p>Phase 1: user registration, login, and profile editing.</p>
        <div className="nav" style={{ marginTop: 16, marginBottom: 0 }}>
          <Link href="/register" className="btn btn-primary">
            Get started
          </Link>
          <Link href="/login" className="btn btn-secondary">
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}
