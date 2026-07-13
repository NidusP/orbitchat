'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/contexts/i18n-context';
import { useInteractionNotifications } from '@/contexts/interaction-notifications-context';
import { useUnreadMessages } from '@/contexts/unread-messages-context';

export function AppHeader() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { totalUnread } = useUnreadMessages();
  const { totalUnread: interactionUnread } = useInteractionNotifications();
  const showNotificationDot = totalUnread > 0 || interactionUnread > 0;
  const isNotificationsPage = pathname === '/notifications';

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/feed" className="app-logo-link" aria-label={t('header.homeAria')}>
          Orbitchat
        </Link>
        <div className="app-header-actions">
          <Link
            href="/notifications"
            className={`app-header-notifications-link ${
              isNotificationsPage ? 'app-header-notifications-link-active' : ''
            }`}
            aria-label={t('header.notificationsAria')}
          >
            <span aria-hidden>🔔</span>
            <span>{t('header.notifications')}</span>
            {showNotificationDot && <span className="app-header-unread-dot" />}
          </Link>
        </div>
      </div>
    </header>
  );
}
