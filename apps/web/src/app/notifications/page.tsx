'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { InteractionNotification } from '@orbitchat/shared-types';
import { InteractionNotificationList } from '@/components/interaction-notification-list';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { useInteractionNotifications } from '@/contexts/interaction-notifications-context';
import { useUnreadMessages } from '@/contexts/unread-messages-context';
import { listNotifications, markNotificationsRead } from '@/lib/api/notifications';

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { totalUnread } = useUnreadMessages();
  const { totalUnread: interactionUnread, refresh: refreshInteractionUnread } =
    useInteractionNotifications();
  const { t } = useI18n();
  const [items, setItems] = useState<InteractionNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const unreadText =
    totalUnread > 0
      ? t('notifications.unreadWithCount', { count: totalUnread })
      : t('notifications.unreadEmpty');

  const interactionUnreadText =
    interactionUnread > 0
      ? t('notifications.interactionsUnreadWithCount', { count: interactionUnread })
      : t('notifications.interactionsUnreadEmpty');

  const loadInteractions = useCallback(async () => {
    setError(null);
    setIsLoadingInteractions(true);

    try {
      const page = await listNotifications({ limit: 20 });
      setItems(page.items);
      setNextCursor(page.nextCursor);

      if (page.items.some((item) => item.readAt === null)) {
        await markNotificationsRead();
        await refreshInteractionUnread();
        setItems((current) =>
          current.map((item) => ({
            ...item,
            readAt: item.readAt ?? new Date().toISOString(),
          }))
        );
      }
    } catch {
      setError(t('notifications.interactionsLoadFailed'));
    } finally {
      setIsLoadingInteractions(false);
    }
  }, [refreshInteractionUnread, t]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadInteractions();
    }
  }, [isAuthenticated, loadInteractions]);

  async function handleLoadMore() {
    if (!nextCursor) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      const page = await listNotifications({ cursor: nextCursor, limit: 20 });
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      setError(t('notifications.interactionsLoadMoreFailed'));
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <main className="main-wide" data-testid="notifications-page">
        <header className="page-header section-header">
          <div>
            <h1>{t('notifications.title')}</h1>
            <p className="text-muted">{t('notifications.subtitle')}</p>
          </div>
        </header>
      </main>
    );
  }

  return (
    <main className="main-wide" data-testid="notifications-page">
      <header className="page-header section-header">
        <div>
          <h1>{t('notifications.title')}</h1>
          <p className="text-muted">{t('notifications.subtitle')}</p>
        </div>
      </header>

      <section className="card notifications-section">
        <div className="section-header">
          <h2 className="section-title">{t('notifications.messagesTitle')}</h2>
          <span className="notifications-count">{totalUnread > 99 ? '99+' : totalUnread}</span>
        </div>
        <p className="text-muted">{unreadText}</p>
        <Link href="/messages" className="btn btn-primary">
          {t('notifications.goToMessages')}
        </Link>
      </section>

      <section className="card notifications-section">
        <div className="section-header">
          <h2 className="section-title">{t('notifications.interactionsTitle')}</h2>
          <span className="notifications-count">
            {interactionUnread > 99 ? '99+' : interactionUnread}
          </span>
        </div>
        <p className="text-muted">{interactionUnreadText}</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {isLoadingInteractions ? (
          <p className="text-muted">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState
            title={t('notifications.interactionsTitle')}
            description={t('notifications.interactionsEmpty')}
            actionLabel={t('notifications.backToFeed')}
            href="/feed"
          />
        ) : (
          <InteractionNotificationList items={items} />
        )}

        {nextCursor && (
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isLoadingMore}
              onClick={() => void handleLoadMore()}
            >
              {isLoadingMore ? t('common.loading') : t('notifications.loadMore')}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
