'use client';

import { useLayoutEffect } from 'react';
import { applyColorScheme, getStoredColorScheme } from '@/lib/app-theme';

export function AppThemeSync() {
  useLayoutEffect(() => {
    applyColorScheme(getStoredColorScheme());
  }, []);

  return null;
}
