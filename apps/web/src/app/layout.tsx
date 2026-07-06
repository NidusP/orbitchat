import '@/styles/globals.css';
import '@/styles/chat.css';
import { AuthProvider } from '@/contexts/auth-context';

export const metadata = {
  title: 'Orbitchat',
  description: 'A learning project for modern full-stack TypeScript development',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
