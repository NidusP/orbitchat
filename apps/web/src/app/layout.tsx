import '@/styles/tokens.css';
import '@/styles/globals.css';
import '@/styles/chat.css';
import { AppChrome } from '@/components/layout/app-chrome';
import { ChatThemeSync } from '@/components/settings/chat-theme-sync';
import { AuthProvider } from '@/contexts/auth-context';
import { ChatWsProvider } from '@/contexts/chat-ws-context';
import { UnreadMessagesProvider } from '@/contexts/unread-messages-context';

export const metadata = {
  title: 'Orbitchat',
  description: '温暖社交与小轨助手，陪你轻松表达、连接朋友、持续对话。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-chat-theme="solid-warm">
      <body>
        <ChatThemeSync />
        <AuthProvider>
          <ChatWsProvider>
            <UnreadMessagesProvider>
              <AppChrome>{children}</AppChrome>
            </UnreadMessagesProvider>
          </ChatWsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
