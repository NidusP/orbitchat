'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUnreadMessages } from '@/contexts/unread-messages-context';

interface TabItem {
  label: string;
  href: string;
  testId: string;
}

const TAB_ITEMS: TabItem[] = [
  { label: '动态', href: '/feed', testId: 'tab-feed' },
  { label: '消息', href: '/messages', testId: 'tab-messages' },
  { label: '小轨', href: '/ai', testId: 'tab-ai' },
  { label: '我的', href: '/profile', testId: 'tab-profile' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/feed') {
    return (
      pathname === '/feed' ||
      pathname.startsWith('/feed/') ||
      pathname.startsWith('/search') ||
      pathname.startsWith('/users/')
    );
  }

  if (href === '/profile') {
    return (
      pathname === '/profile' ||
      pathname.startsWith('/profile/') ||
      pathname.startsWith('/settings/')
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomTabNav() {
  const pathname = usePathname();
  const { totalUnread } = useUnreadMessages();
  const unreadBadgeText = totalUnread > 99 ? '99+' : String(totalUnread);

  return (
    <nav className="bottom-tab-nav" aria-label="主导航">
      <div className="bottom-tab-nav-inner">
        {TAB_ITEMS.map((item) => {
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
