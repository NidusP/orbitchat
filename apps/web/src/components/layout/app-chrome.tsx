'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { AppHeader } from '@/components/layout/app-header';
import { BottomTabNav } from '@/components/layout/bottom-tab-nav';

const NO_CHROME_EXACT_PATHS = new Set(['/', '/login', '/register']);

function shouldHideChrome(pathname: string): boolean {
  if (NO_CHROME_EXACT_PATHS.has(pathname)) {
    return true;
  }

  return pathname === '/invites' || pathname.startsWith('/invites/');
}

interface AppChromeProps {
  children: ReactNode;
}

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  const showChrome = !isLoading && isAuthenticated && !shouldHideChrome(pathname);

  return (
    <div className="app-chrome">
      {showChrome && <AppHeader />}
      <div className={`app-main ${showChrome ? 'app-main-with-tabs' : ''}`}>{children}</div>
      {showChrome && <BottomTabNav />}
    </div>
  );
}
