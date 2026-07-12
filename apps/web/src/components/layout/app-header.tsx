'use client';

import Link from 'next/link';

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/feed" className="app-logo-link" aria-label="Orbitchat 首页">
          Orbitchat
        </Link>
      </div>
    </header>
  );
}
