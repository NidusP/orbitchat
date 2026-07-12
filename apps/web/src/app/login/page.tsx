import Link from 'next/link';
import { Suspense } from 'react';
import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <main>
      <header className="page-header">
        <h1>登录</h1>
        <p>登录你的 Orbitchat 账号，继续聊天与探索。</p>
      </header>

      <div className="card">
        <Suspense fallback={<p className="text-muted">加载中…</p>}>
          <LoginForm />
        </Suspense>

        <p className="text-muted" style={{ marginTop: 16 }}>
          还没有账号？<Link href="/register">立即注册</Link>
        </p>
      </div>
    </main>
  );
}
