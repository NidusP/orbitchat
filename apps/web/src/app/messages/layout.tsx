'use client';

import { ChatWsProvider } from '@/contexts/chat-ws-context';
import type { ReactNode } from 'react';

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return <ChatWsProvider>{children}</ChatWsProvider>;
}
