'use client';

import Link from 'next/link';
import type { InteractionNotification } from '@orbitchat/shared-types';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useI18n } from '@/contexts/i18n-context';

interface InteractionNotificationListProps {
  items: InteractionNotification[];
}

function formatNotificationMessage(
  notification: InteractionNotification,
  t: ReturnType<typeof useI18n>['t']
): string {
  if (notification.type === 'post_commented') {
    return t('notifications.commentedOnYourPost', { name: notification.actor.displayName });
  }

  return t('notifications.likedYourPost', { name: notification.actor.displayName });
}

export function InteractionNotificationList({ items }: InteractionNotificationListProps) {
  const { t } = useI18n();

  return (
    <ul className="interaction-notification-list" data-testid="interaction-notification-list">
      {items.map((notification) => {
        const isUnread = notification.readAt === null;

        return (
          <li
            key={notification.id}
            className={`interaction-notification-item ${isUnread ? 'interaction-notification-unread' : ''}`}
            data-testid={`interaction-notification-${notification.id}`}
          >
            <Link href={`/posts/${notification.post.id}`} className="interaction-notification-link">
              <UserAvatar
                displayName={notification.actor.displayName}
                userId={notification.actor.id}
                avatarUrl={notification.actor.avatarUrl}
                size="md"
              />
              <div className="interaction-notification-body">
                <p className="interaction-notification-title">
                  {formatNotificationMessage(notification, t)}
                </p>
                <p className="interaction-notification-preview">{notification.post.contentPreview}</p>
                {notification.comment && (
                  <p className="interaction-notification-comment-preview">
                    {notification.comment.contentPreview}
                  </p>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
