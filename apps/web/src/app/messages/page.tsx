'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { Conversation } from '@orbitchat/shared-types';
import { EmptyState } from '@/components/ui/empty-state';
import { ConversationListSkeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/contexts/auth-context';
import { useChatWs } from '@/contexts/chat-ws-context';
import { useI18n } from '@/contexts/i18n-context';
import {
  getConversationDisplayName,
  getOtherParticipant,
  listConversations,
} from '@/lib/api/conversations';

function previewContent(content: string, max = 72): string {
  const trimmed = content.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function formatListTime(iso: string | null, locale: 'zh' | 'en'): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const localeTag = locale === 'zh' ? 'zh-CN' : 'en-US';
  return sameDay
    ? date.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(localeTag);
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
  const { locale, t } = useI18n();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const page = await listConversations({ limit: 50 });
      setConversations(sortConversations(page.items));
    } catch {
      setError(t('messagesList.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

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
        <header className="page-header section-header">
          <h1>{t('messagesList.title')}</h1>
        </header>
        <ConversationListSkeleton count={4} />
      </main>
    );
  }

  return (
    <main className="main-wide">
      <header className="page-header section-header">
        <h1>{t('messagesList.title')}</h1>
        <Link href="/messages/new-group" className="btn btn-primary">
          {t('messagesList.createGroup')}
        </Link>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {conversations.length === 0 ? (
        <EmptyState
          title={t('messagesList.emptyTitle')}
          description={t('messagesList.emptyDescription')}
          actionLabel={t('messagesList.startDm')}
          href="/search"
        >
          <Link href="/messages/new-group" className="btn btn-secondary">
            {t('messagesList.createGroup')}
          </Link>
        </EmptyState>
      ) : (
        <ul className="conversation-list">
          {conversations.map((conversation) => {
            const title = user
              ? getConversationDisplayName(conversation, user.id)
              : t('messagesList.fallbackTitle');
            const otherParticipant = user ? getOtherParticipant(conversation, user.id) : null;
            const avatarDisplayName =
              conversation.type === 'group'
                ? conversation.title?.trim() || t('messagesList.fallbackGroupName')
                : otherParticipant?.displayName ?? title;
            const avatarUserId =
              conversation.type === 'group'
                ? conversation.id
                : otherParticipant?.id ?? conversation.id;
            const avatarUrl =
              conversation.type === 'group'
                ? null
                : otherParticipant?.avatarUrl ?? null;
            const preview = conversation.lastMessage?.content ?? t('messagesList.noMessagesYet');
            const memberHint =
              conversation.type === 'group'
                ? t('messagesList.members', { count: conversation.participants.length })
                : null;

            return (
              <li key={conversation.id}>
                <Link
                  href={`/messages/${conversation.id}`}
                  className="conversation-list-item conversation-list-item-with-avatar"
                >
                  <UserAvatar
                    displayName={avatarDisplayName}
                    userId={avatarUserId}
                    avatarUrl={avatarUrl}
                    size="md"
                  />
                  <div className="conversation-list-content">
                    <div className="conversation-list-main">
                      <span className="conversation-list-title">{title}</span>
                      <span className="conversation-list-time">
                        {formatListTime(conversation.lastMessageAt, locale)}
                      </span>
                    </div>
                    <div className="conversation-list-preview-row">
                      <span className="conversation-list-preview">
                        {memberHint
                          ? `${memberHint} · ${previewContent(preview)}`
                          : previewContent(preview)}
                      </span>
                      {conversation.unreadCount > 0 && (
                        <span className="conversation-unread-badge">{conversation.unreadCount}</span>
                      )}
                    </div>
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
