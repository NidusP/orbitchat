'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/contexts/i18n-context';
import { useUnreadMessages } from '@/contexts/unread-messages-context';

interface TabItem {
  label: string;
  href: string;
  testId: string;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/feed') {
    return (
      pathname === '/feed' ||
      pathname.startsWith('/feed/') ||
      pathname.startsWith('/search') ||
      pathname.startsWith('/users/') ||
      pathname.startsWith('/posts/')
    );
  }

  if (href === '/profile') {
    return (
      pathname === '/profile' ||
      pathname.startsWith('/profile/') ||
      pathname.startsWith('/settings/') ||
      pathname === '/notifications' ||
      pathname.startsWith('/notifications/')
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomTabNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { totalUnread } = useUnreadMessages();
  const unreadBadgeText = totalUnread > 99 ? '99+' : String(totalUnread);
  const tabItems: TabItem[] = [
    { label: t('tabs.feed'), href: '/feed', testId: 'tab-feed' },
    { label: t('tabs.messages'), href: '/messages', testId: 'tab-messages' },
    { label: t('tabs.ai'), href: '/ai', testId: 'tab-ai' },
    { label: t('tabs.profile'), href: '/profile', testId: 'tab-profile' },
  ];

  return (
    <nav className="bottom-tab-nav" aria-label={t('navigation.mainAria')}>
      <div className="bottom-tab-nav-inner">
        {tabItems.map((item) => {
          const active = isActive(pathname, item.href);
          const isMessagesTab = item.href === '/messages';
          const shouldShowUnreadBadge = isMessagesTab && totalUnread > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-tab-link ${active ? 'bottom-tab-link-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              data-testid={item.testId}
            >
              <span className="bottom-tab-link-label">
                {item.label}
                {shouldShowUnreadBadge && (
                  <span className="bottom-tab-link-badge" data-testid="tab-messages-badge">
                    {unreadBadgeText}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
