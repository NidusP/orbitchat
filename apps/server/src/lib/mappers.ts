import type { Profile, User, UserSession } from '@orbitchat/shared-types';
import type { Profile as DbProfile } from '../db/schema/profiles';
import type { UserSession as DbUserSession } from '../db/schema/user-sessions';
import type { User as DbUser } from '../db/schema/users';

function toIsoString(date: Date): string {
  return date.toISOString();
}

export function toUserDto(user: DbUser): User {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isActive: user.isActive,
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
  };
}

export function toProfileDto(profile: DbProfile): Profile {
  return {
    id: profile.id,
    userId: profile.userId,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    createdAt: toIsoString(profile.createdAt),
    updatedAt: toIsoString(profile.updatedAt),
  };
}

export function toSessionDto(session: DbUserSession): UserSession {
  return {
    id: session.id,
    userId: session.userId,
    deviceId: session.deviceId,
    platform: session.platform,
    deviceName: session.deviceName,
    isTrusted: session.isTrusted,
    lastActiveAt: toIsoString(session.lastActiveAt),
    expiresAt: toIsoString(session.expiresAt),
    createdAt: toIsoString(session.createdAt),
  };
}
