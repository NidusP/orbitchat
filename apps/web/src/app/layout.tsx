import '@/styles/tokens.css';
import '@/styles/globals.css';
import '@/styles/chat.css';
import { AppChrome } from '@/components/layout/app-chrome';
import { AppThemeSync } from '@/components/settings/app-theme-sync';
import { ChatThemeSync } from '@/components/settings/chat-theme-sync';
import { AuthProvider } from '@/contexts/auth-context';
import { ChatWsProvider } from '@/contexts/chat-ws-context';
import { I18nProvider } from '@/contexts/i18n-context';
import { InteractionNotificationsProvider } from '@/contexts/interaction-notifications-context';
import { UnreadMessagesProvider } from '@/contexts/unread-messages-context';

export const metadata = {
  title: 'Orbitchat',
  description:
    'Warm social moments and Orbit assistant - express yourself, stay connected, and keep conversations going.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-chat-theme="solid-warm" data-color-scheme="light" suppressHydrationWarning>
      <body>
        <AppThemeSync />
        <ChatThemeSync />
        <AuthProvider>
          <I18nProvider>
            <ChatWsProvider>
              <UnreadMessagesProvider>
                <InteractionNotificationsProvider>
                  <AppChrome>{children}</AppChrome>
                </InteractionNotificationsProvider>
              </UnreadMessagesProvider>
            </ChatWsProvider>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
