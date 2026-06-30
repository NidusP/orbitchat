'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';

export function SiteNav() {
  const { isAuthenticated, isLoading, logout } = useAuth();

  return (
    <nav className="nav">
      <Link href="/">Home</Link>
      {!isLoading && isAuthenticated && (
        <>
          <Link href="/feed">Feed</Link>
          <Link href="/search">Search</Link>
          <Link href="/profile">Profile</Link>
          <Link href="/settings/sessions">Sessions</Link>
        </>
      )}
      {!isLoading && !isAuthenticated && (
        <>
          <Link href="/login">Login</Link>
          <Link href="/register">Register</Link>
        </>
      )}
      {!isLoading && isAuthenticated && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            void logout();
          }}
        >
          Logout
        </button>
      )}
    </nav>
  );
}
