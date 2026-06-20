import type { ClientPlatform } from '@orbitchat/shared-types';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { db } from '../db';
import { userSessions } from '../db/schema/user-sessions';
import { AppError } from '../lib/errors';
import { generateRefreshToken, hashRefreshToken } from '../lib/crypto';
import { toSessionDto } from '../lib/mappers';

export async function revokePlatformSessions(userId: string, platform: ClientPlatform): Promise<void> {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userSessions.userId, userId),
        eq(userSessions.platform, platform),
        isNull(userSessions.revokedAt)
      )
    );
}

export async function createSession(input: {
  userId: string;
  deviceId: string;
  platform: ClientPlatform;
  deviceName?: string;
  isTrusted: boolean;
  expiresAt: Date;
}) {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const [session] = await db
    .insert(userSessions)
    .values({
      userId: input.userId,
      deviceId: input.deviceId,
      platform: input.platform,
      deviceName: input.deviceName ?? null,
      isTrusted: input.isTrusted,
      refreshTokenHash,
      expiresAt: input.expiresAt,
    })
    .returning();

  return {
    session,
    refreshToken,
  };
}

export async function findActiveSessionById(sessionId: string) {
  return db.query.userSessions.findFirst({
    where: and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)),
  });
}

export async function findSessionByRefreshToken(refreshToken: string) {
  const refreshTokenHash = hashRefreshToken(refreshToken);

  return db.query.userSessions.findFirst({
    where: and(eq(userSessions.refreshTokenHash, refreshTokenHash), isNull(userSessions.revokedAt)),
  });
}

export async function assertValidSession(sessionId: string) {
  const session = await findActiveSessionById(sessionId);

  if (!session) {
    throw new AppError('UNAUTHORIZED', 'Session is invalid or expired', 401);
  }

  if (session.expiresAt <= new Date()) {
    await revokeSessionById(session.id);
    throw new AppError('UNAUTHORIZED', 'Session is invalid or expired', 401);
  }

  return session;
}

export async function rotateRefreshToken(sessionId: string, expiresAt: Date) {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const [session] = await db
    .update(userSessions)
    .set({
      refreshTokenHash,
      lastActiveAt: new Date(),
      expiresAt,
    })
    .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)))
    .returning();

  if (!session) {
    throw new AppError('SESSION_REVOKED', 'Session has been revoked', 401);
  }

  return {
    session,
    refreshToken,
  };
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)));
}

export async function revokeAllExcept(userId: string, currentSessionId: string): Promise<number> {
  const revoked = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userSessions.userId, userId),
        ne(userSessions.id, currentSessionId),
        isNull(userSessions.revokedAt)
      )
    )
    .returning({ id: userSessions.id });

  return revoked.length;
}

export async function listActiveSessionsForUser(userId: string) {
  const sessions = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
    .orderBy(desc(userSessions.lastActiveAt));

  return sessions.map(toSessionDto);
}

export async function updateSessionTrust(sessionId: string, userId: string, trust: boolean) {
  const [session] = await db
    .update(userSessions)
    .set({ isTrusted: trust })
    .where(
      and(
        eq(userSessions.id, sessionId),
        eq(userSessions.userId, userId),
        isNull(userSessions.revokedAt)
      )
    )
    .returning();

  if (!session) {
    throw new AppError('NOT_FOUND', 'Session not found', 404);
  }

  return toSessionDto(session);
}

export async function touchSession(sessionId: string): Promise<void> {
  await db
    .update(userSessions)
    .set({ lastActiveAt: new Date() })
    .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)));
}
