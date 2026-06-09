export const metadata = {
  title: 'Orbitchat',
  description: 'A learning project for modern full-stack TypeScript development',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
