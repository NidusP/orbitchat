'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { ApiError } from '@/lib/api/errors';
import { resendVerification } from '@/lib/api/auth';
import { uploadFile } from '@/lib/api/uploads';
import { getProfile, updateProfile, updateUser } from '@/lib/api/users';

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, refreshUser, logout } = useAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [isAccountSubmitting, setIsAccountSubmitting] = useState(false);
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationBannerError, setVerificationBannerError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (window.sessionStorage.getItem('orbitchat.verifyPending') === '1') {
      setVerificationNotice(t('auth.registerVerificationPending'));
      window.sessionStorage.removeItem('orbitchat.verifyPending');
    }
  }, [t]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

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
          setAvatarUrl(profile.avatarUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setProfileError(
            err instanceof ApiError
              ? t('profile.errors.loadProfileWithMessage', { message: err.message })
              : t('profile.errors.loadProfile')
          );
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
  }, [user, t]);

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
      setAccountSuccess(t('profile.success.accountUpdated'));
    } catch (err) {
      setAccountError(
        err instanceof ApiError
          ? t('profile.errors.updateAccountWithMessage', { message: err.message })
          : t('profile.errors.updateAccount')
      );
    } finally {
      setIsAccountSubmitting(false);
    }
  }

  async function handleAvatarSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user) {
      return;
    }

    setAvatarError(null);
    setIsAvatarUploading(true);

    const localPreview = URL.createObjectURL(file);
    setAvatarPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return localPreview;
    });

    try {
      const uploaded = await uploadFile(file, 'avatar');
      const updated = await updateProfile(user.id, { avatarUploadId: uploaded.id });
      setAvatarUrl(updated.avatarUrl);
      setAvatarPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });
      setProfileSuccess(t('profile.success.avatarUpdated'));
    } catch (err) {
      setAvatarPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });
      setAvatarError(
        err instanceof ApiError
          ? t('profile.errors.avatarUploadWithMessage', { message: err.message })
          : t('profile.errors.avatarUpload')
      );
    } finally {
      setIsAvatarUploading(false);
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
      setProfileSuccess(t('profile.success.profileUpdated'));
    } catch (err) {
      setProfileError(
        err instanceof ApiError
          ? t('profile.errors.updateProfileWithMessage', { message: err.message })
          : t('profile.errors.updateProfile')
      );
    } finally {
      setIsProfileSubmitting(false);
    }
  }

  async function handleResendVerification(): Promise<void> {
    setVerificationBannerError(null);
    setIsResendingVerification(true);

    try {
      await resendVerification();
      setVerificationNotice(t('profile.emailUnverifiedResent'));
    } catch (err) {
      setVerificationBannerError(
        err instanceof ApiError
          ? err.message
          : t('auth.verifyEmail.resendFailed')
      );
    } finally {
      setIsResendingVerification(false);
    }
  }

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (isLoading || !user) {
    return (
      <main>
        <p className="text-muted">{t('profile.loading')}</p>
      </main>
    );
  }

  return (
    <main>
      <header className="page-header section-header">
        <div>
          <h1>{t('profile.title')}</h1>
          <p>{t('profile.subtitle')}</p>
        </div>
        <div className="profile-header-actions">
          <Link href="/notifications" className="btn btn-secondary">
            {t('profile.notifications')}
          </Link>
          <Link href="/settings" className="btn btn-secondary">
            {t('profile.settings')}
          </Link>
        </div>
      </header>

      {verificationNotice && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {verificationNotice}
        </div>
      )}

      {user.emailVerifiedAt === null && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0 }}>{t('profile.emailUnverifiedBanner')}</p>
          {verificationBannerError && (
            <p style={{ margin: '8px 0 0' }}>{verificationBannerError}</p>
          )}
          <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={isResendingVerification}
              onClick={() => {
                void handleResendVerification();
              }}
            >
              {isResendingVerification
                ? t('profile.emailUnverifiedResending')
                : t('profile.emailUnverifiedResend')}
            </button>
            <Link href="/verify-email" className="btn btn-secondary btn-sm">
              {t('auth.verifyEmail.submit')}
            </Link>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="section-title">{t('profile.account.title')}</h2>
        <form className="form" onSubmit={handleAccountSubmit}>
          {accountError && <div className="alert alert-error">{accountError}</div>}
          {accountSuccess && <div className="alert alert-success">{accountSuccess}</div>}

          <div className="field">
            <label htmlFor="username">{t('profile.account.username')}</label>
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
            <label htmlFor="email">{t('profile.account.email')}</label>
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
            {isAccountSubmitting ? t('profile.account.saving') : t('profile.account.save')}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="section-title">{t('profile.public.title')}</h2>
        {profileLoading ? (
          <p className="text-muted">{t('profile.public.loading')}</p>
        ) : (
          <form className="form" onSubmit={handleProfileSubmit}>
            {profileError && <div className="alert alert-error">{profileError}</div>}
            {profileSuccess && <div className="alert alert-success">{profileSuccess}</div>}
            {avatarError && <div className="alert alert-error">{avatarError}</div>}

            <div className="field profile-avatar-field">
              <span className="field-label">{t('profile.public.avatar')}</span>
              <div className="profile-avatar-row">
                <UserAvatar
                  displayName={displayName || user.username}
                  userId={user.id}
                  avatarUrl={avatarPreviewUrl ?? avatarUrl}
                  size="lg"
                />
                <div className="profile-avatar-actions">
                  <input
                    ref={avatarInputRef}
                    id="avatar-upload"
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    hidden
                    data-testid="profile-avatar-input"
                    onChange={(event) => {
                      void handleAvatarSelected(event);
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    data-testid="profile-avatar-change"
                    disabled={isAvatarUploading}
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {isAvatarUploading
                      ? t('profile.public.uploadingAvatar')
                      : t('profile.public.changeAvatar')}
                  </button>
                </div>
              </div>
            </div>

            <div className="field">
              <label htmlFor="displayName">{t('profile.public.displayName')}</label>
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
              <label htmlFor="bio">{t('profile.public.bio')}</label>
              <textarea
                id="bio"
                maxLength={500}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={isProfileSubmitting}>
              {isProfileSubmitting ? t('profile.public.saving') : t('profile.public.save')}
            </button>
          </form>
        )}
      </div>

      <p className="text-muted" style={{ marginTop: 16 }}>
        <Link href="/settings/sessions">{t('profile.links.sessions')}</Link>
        {' · '}
        <Link href="/">{t('profile.links.home')}</Link>
      </p>

      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="profile-logout"
          disabled={isLoggingOut}
          onClick={() => {
            void handleLogout();
          }}
        >
          {isLoggingOut ? t('profile.loggingOut') : t('profile.logout')}
        </button>
      </div>
    </main>
  );
}
