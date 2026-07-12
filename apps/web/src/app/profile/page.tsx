'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { SiteNav } from '@/components/site-nav';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api/errors';
import { getProfile, updateProfile, updateUser } from '@/lib/api/users';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [isAccountSubmitting, setIsAccountSubmitting] = useState(false);
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const userId = user.id;
    let cancelled = false;

    async function loadProfile() {
      setProfileLoading(true);
      setProfileError(null);

      try {
        const profile = await getProfile(userId);
        if (!cancelled) {
          setDisplayName(profile.displayName);
          setBio(profile.bio ?? '');
        }
      } catch (err) {
        if (!cancelled) {
          setProfileError(err instanceof ApiError ? `加载资料失败：${err.message}` : '加载资料失败。');
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    if (!cancelled) {
      setUsername(user.username);
      setEmail(user.email);
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }

    setAccountError(null);
    setAccountSuccess(null);
    setIsAccountSubmitting(true);

    try {
      await updateUser(user.id, {
        username: username.trim(),
        email: email.trim(),
      });
      await refreshUser();
      setAccountSuccess('账号信息已更新。');
    } catch (err) {
      setAccountError(err instanceof ApiError ? `更新账号失败：${err.message}` : '更新账号失败。');
    } finally {
      setIsAccountSubmitting(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      return;
    }

    setProfileError(null);
    setProfileSuccess(null);
    setIsProfileSubmitting(true);

    try {
      await updateProfile(user.id, {
        displayName,
        bio: bio.trim() === '' ? null : bio,
      });
      setProfileSuccess('个人资料已更新。');
    } catch (err) {
      setProfileError(err instanceof ApiError ? `更新资料失败：${err.message}` : '更新资料失败。');
    } finally {
      setIsProfileSubmitting(false);
    }
  }

  if (isLoading || !user) {
    return (
      <main>
        <SiteNav />
        <p className="text-muted">加载中…</p>
      </main>
    );
  }

  return (
    <main>
      <SiteNav />
      <header className="page-header section-header">
        <div>
          <h1>我的</h1>
          <p>查看并编辑你的账号与公开资料。</p>
        </div>
        <Link href="/settings" className="btn btn-secondary">
          设置
        </Link>
      </header>

      <div className="card">
        <h2 className="section-title">账号信息</h2>
        <form className="form" onSubmit={handleAccountSubmit}>
          {accountError && <div className="alert alert-error">{accountError}</div>}
          {accountSuccess && <div className="alert alert-success">{accountSuccess}</div>}

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

          <button type="submit" className="btn btn-primary" disabled={isAccountSubmitting}>
            {isAccountSubmitting ? '保存中…' : '保存账号信息'}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="section-title">公开资料</h2>
        {profileLoading ? (
          <p className="text-muted">资料加载中…</p>
        ) : (
          <form className="form" onSubmit={handleProfileSubmit}>
            {profileError && <div className="alert alert-error">{profileError}</div>}
            {profileSuccess && <div className="alert alert-success">{profileSuccess}</div>}

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
              <label htmlFor="bio">简介</label>
              <textarea
                id="bio"
                maxLength={500}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={isProfileSubmitting}>
              {isProfileSubmitting ? '保存中…' : '保存公开资料'}
            </button>
          </form>
        )}
      </div>

      <p className="text-muted" style={{ marginTop: 16 }}>
        <Link href="/settings/sessions">管理会话</Link>
        {' · '}
        <Link href="/">返回首页</Link>
      </p>
    </main>
  );
}
