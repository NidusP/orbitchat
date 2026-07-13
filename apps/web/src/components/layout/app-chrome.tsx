'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { AppHeader } from '@/components/layout/app-header';
import { BottomTabNav } from '@/components/layout/bottom-tab-nav';
import { WelcomeGuide } from '@/components/onboarding/welcome-guide';
import { hasCompletedOnboarding, markOnboardingComplete } from '@/lib/onboarding';

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
  const [showOnboarding, setShowOnboarding] = useState(false);

  const showChrome = !isLoading && isAuthenticated && !shouldHideChrome(pathname);

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      setShowOnboarding(false);
      return;
    }

    if (pathname !== '/feed') {
      setShowOnboarding(false);
      return;
    }

    setShowOnboarding(!hasCompletedOnboarding());
  }, [isAuthenticated, isLoading, pathname]);

  function handleOnboardingDone(): void {
    markOnboardingComplete();
    setShowOnboarding(false);
  }

  return (
    <div className="app-chrome">
      {showChrome && <AppHeader />}
      <div className={`app-main ${showChrome ? 'app-main-with-tabs' : ''}`}>{children}</div>
      {showChrome && <BottomTabNav />}
      {showChrome && pathname === '/feed' && showOnboarding && (
        <WelcomeGuide onComplete={handleOnboardingDone} onSkip={handleOnboardingDone} />
      )}
    </div>
  );
}
