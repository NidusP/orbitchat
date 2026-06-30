import { Suspense } from 'react';
import { SearchPageClient } from './search-page-client';

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="main-wide">
          <p className="text-muted">Loading search…</p>
        </main>
      }
    >
      <SearchPageClient />
    </Suspense>
  );
}
