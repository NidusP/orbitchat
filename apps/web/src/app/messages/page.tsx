'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { Conversation } from '@orbitchat/shared-types';
import { SiteNav } from '@/components/site-nav';
import { useAuth } from '@/contexts/auth-context';
import { useChatWs } from '@/contexts/chat-ws-context';
import { ApiError } from '@/lib/api/errors';
import { getOtherParticipant, listConversations } from '@/lib/api/conversations';

function previewContent(content: string, max = 72): string {
  const trimmed = content.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function formatListTime(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString();
}

function sortConversations(items: Conversation[]): Conversation[] {
  return [...items].sort((left, right) => {
    const leftTime = left.lastMessageAt ?? left.updatedAt;
    const rightTime = right.lastMessageAt ?? right.updatedAt;
    return rightTime.localeCompare(leftTime);
  });
}

function upsertConversation(
  items: Conversation[],
  conversationId: string,
  updater: (current: Conversation) => Conversation
): Conversation[] {
  const index = items.findIndex((item) => item.id === conversationId);
  if (index === -1) {
    return items;
  }
  const next = [...items];
  next[index] = updater(next[index]);
  return sortConversations(next);
}

export default function MessagesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { subscribe } = useChatWs();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const page = await listConversations({ limit: 50 });
      setConversations(sortConversations(page.items));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load conversations.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void loadConversations();
  }, [isAuthenticated, loadConversations]);

  useEffect(() => {
    if (!user) {
      return;
    }

    return subscribe((event) => {
      if (event.type === 'message.new') {
        const { payload } = event;
        setConversations((current) =>
          upsertConversation(current, payload.conversationId, (conversation) => ({
            ...conversation,
            lastMessage: payload.message,
            lastMessageAt: payload.message.createdAt,
            unreadCount:
              payload.message.sender.id === user.id
                ? conversation.unreadCount
                : conversation.unreadCount + 1,
          }))
        );
      }

      if (event.type === 'message.read' && event.payload.userId === user.id) {
        setConversations((current) =>
          upsertConversation(current, event.payload.conversationId, (conversation) => ({
            ...conversation,
            unreadCount: 0,
          }))
        );
      }
    });
  }, [subscribe, user]);

  if (authLoading || isLoading) {
    return (
      <main className="main-wide">
        <SiteNav />
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <SiteNav />
      <header className="page-header section-header">
        <h1>Messages</h1>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {conversations.length === 0 ? (
        <div className="card empty-state">
          <p className="text-muted">No conversations yet.</p>
          <p className="text-muted">
            Visit a user profile and click <strong>Message</strong> to start chatting.
          </p>
          <Link href="/search" className="btn btn-primary" style={{ marginTop: 12 }}>
            Find people
          </Link>
        </div>
      ) : (
        <ul className="conversation-list">
          {conversations.map((conversation) => {
            const other = user ? getOtherParticipant(conversation, user.id) : null;
            const title = other?.displayName ?? 'Conversation';
            const preview = conversation.lastMessage?.content ?? 'No messages yet';

            return (
              <li key={conversation.id}>
                <Link href={`/messages/${conversation.id}`} className="conversation-list-item">
                  <div className="conversation-list-main">
                    <span className="conversation-list-title">{title}</span>
                    <span className="conversation-list-time">
                      {formatListTime(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <div className="conversation-list-preview-row">
                    <span className="conversation-list-preview">{previewContent(preview)}</span>
                    {conversation.unreadCount > 0 && (
                      <span className="conversation-unread-badge">{conversation.unreadCount}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
