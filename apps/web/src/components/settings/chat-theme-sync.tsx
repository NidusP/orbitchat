'use client';

import { useEffect } from 'react';
import { applyChatTheme, getStoredChatTheme } from '@/lib/chat-theme';

export function ChatThemeSync() {
  useEffect(() => {
    applyChatTheme(getStoredChatTheme());
  }, []);

  return null;
}
