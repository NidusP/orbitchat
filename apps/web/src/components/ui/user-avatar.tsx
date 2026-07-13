'use client';

import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { getAvatarColors, getAvatarInitials } from '@/lib/avatar-utils';
import { resolveMediaUrl } from '@/lib/media-url';

type UserAvatarSize = 'sm' | 'md' | 'lg';

interface UserAvatarProps {
  displayName: string;
  userId?: string;
  avatarUrl?: string | null;
  size?: UserAvatarSize;
}

export function UserAvatar({
  displayName,
  userId,
  avatarUrl,
  size = 'md',
}: UserAvatarProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const initials = useMemo(() => getAvatarInitials(displayName), [displayName]);
  const colors = useMemo(() => getAvatarColors(userId), [userId]);
  const resolvedAvatarUrl = useMemo(
    () => (avatarUrl ? resolveMediaUrl(avatarUrl) : null),
    [avatarUrl]
  );
  const shouldShowImage = Boolean(resolvedAvatarUrl) && !imageLoadFailed;

  useEffect(() => {
    setImageLoadFailed(false);
  }, [resolvedAvatarUrl]);

  return (
    <span
      className={`user-avatar user-avatar-${size}`}
      style={
        {
          '--avatar-bg': colors.backgroundColor,
          '--avatar-fg': colors.textColor,
        } as CSSProperties
      }
      aria-label={displayName}
      title={displayName}
    >
      {shouldShowImage ? (
        <img
          src={resolvedAvatarUrl ?? ''}
          alt={displayName}
          onError={() => setImageLoadFailed(true)}
        />
      ) : (
        <span className="user-avatar-initials">{initials}</span>
      )}
    </span>
  );
}
