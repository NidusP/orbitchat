'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { isValidPassword } from '@orbitchat/shared-utils';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/errors';

export default function RegisterPage() {
  const router = useRouter();
  const { register, login } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!isValidPassword(password)) {
      setError('密码至少 8 位，且包含大写字母、小写字母和数字。');
      setIsSubmitting(false);
      return;
    }

    try {
      await register({
        username,
        email,
        password,
        displayName,
      });
      await login({
        email,
        password,
        trustDevice,
      });
      router.push('/profile');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message ? `注册失败：${err.message}` : '注册失败，请检查输入信息。');
      } else {
        setError('注册失败，请稍后重试。');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <h1>注册</h1>
        <p>创建你的 Orbitchat 新账号。</p>
      </header>

      <div className="card">
        <form className="form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_]+"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="displayName">显示名称</label>
            <input
              id="displayName"
              type="text"
              required
              maxLength={128}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="email">邮箱</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <span className="text-muted">
              至少 8 位，且包含大写字母、小写字母和数字（例如 Password123）。
            </span>
          </div>

          <label className="field-checkbox">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(event) => setTrustDevice(event.target.checked)}
            />
            信任此设备
          </label>

          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? '创建中…' : '创建账号'}
          </button>
        </form>

        <p className="text-muted" style={{ marginTop: 16 }}>
          已有账号？<Link href="/login">去登录</Link>
        </p>
      </div>
    </main>
  );
}
