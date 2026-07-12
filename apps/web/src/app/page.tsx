'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/feed');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || isAuthenticated) {
    return (
      <main>
        <p className="text-muted">加载中…</p>
      </main>
    );
  }

  return (
    <main className="main-wide">
      <header className="page-header">
        <h1>Orbitchat</h1>
        <p>温暖社交，真诚交流。和朋友保持连接，也让小轨助手随时陪你聊天与记录灵感。</p>
      </header>

      <div className="card">
        <p>在动态里发现同频的人，在消息里继续对话，在小轨里获得贴心陪伴。</p>
        <div className="nav" style={{ marginTop: 16, marginBottom: 0 }}>
          <Link href="/register" className="btn btn-primary">
            立即注册
          </Link>
          <Link href="/login" className="btn btn-secondary">
            登录账号
          </Link>
        </div>
      </div>
    </main>
  );
}
