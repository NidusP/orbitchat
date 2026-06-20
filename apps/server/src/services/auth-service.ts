import type {
  LoginResponse,
  LogoutAllResponse,
  LogoutResponse,
  RefreshResponse,
  RegisterResponse,
  RevokeSessionResponse,
  SessionListResponse,
  TrustSessionResponse,
} from '@orbitchat/shared-types';
import { env } from '../env';
import { AppError } from '../lib/errors';
import { verifyPassword } from '../lib/crypto';
import { getAccessTokenTtlSeconds, signAccessToken } from '../lib/jwt';
import { toSessionDto, toUserDto } from '../lib/mappers';
import { ttlToDate } from '../lib/ttl';
import type { ClientMeta } from '../middleware/client-meta';
import type { LoginInput, RegisterInput } from '../schemas/auth';
import {
  createSession,
  findSessionByRefreshToken,
  listActiveSessionsForUser,
  revokeAllExcept,
  revokePlatformSessions,
  revokeSessionById,
  rotateRefreshToken,
  updateSessionTrust,
} from './session-service';
import { assertActiveUser, findUserByEmail, registerUser } from './user-service';

const REMEMBER_ME_REFRESH_TTL = '7d';

export interface AuthTokenBundle {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

function resolveRefreshExpiry(rememberMe?: boolean): Date {
  const ttl = rememberMe === false ? REMEMBER_ME_REFRESH_TTL : env.JWT_REFRESH_TTL;
  return ttlToDate(ttl);
}

export async function register(input: RegisterInput): Promise<RegisterResponse> {
  return registerUser(input);
}

export async function login(
  input: LoginInput,
  clientMeta: ClientMeta
): Promise<LoginResponse & AuthTokenBundle> {
  const user = await findUserByEmail(input.email);

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401);
  }

  if (!user.isActive) {
    throw new AppError('FORBIDDEN', 'Account is inactive', 403);
  }

  await revokePlatformSessions(user.id, clientMeta.platform);

  const expiresAt = resolveRefreshExpiry(input.rememberMe);
  const { session, refreshToken } = await createSession({
    userId: user.id,
    deviceId: clientMeta.deviceId,
    platform: clientMeta.platform,
    deviceName: input.deviceName,
    isTrusted: input.trustDevice ?? false,
    expiresAt,
  });

  const accessToken = await signAccessToken({
    userId: user.id,
    sessionId: session.id,
    platform: clientMeta.platform,
    email: user.email,
  });

  return {
    accessToken,
    expiresIn: getAccessTokenTtlSeconds(),
    user: toUserDto(user),
    session: toSessionDto(session),
    refreshToken,
    refreshExpiresAt: session.expiresAt,
  };
}

export async function refreshSession(
  refreshToken: string,
  clientMeta: ClientMeta
): Promise<RefreshResponse & AuthTokenBundle> {
  const session = await findSessionByRefreshToken(refreshToken);

  if (!session) {
    throw new AppError('UNAUTHORIZED', 'Invalid refresh token', 401);
  }

  if (session.expiresAt <= new Date()) {
    await revokeSessionById(session.id);
    throw new AppError('UNAUTHORIZED', 'Refresh token expired', 401);
  }

  if (session.platform !== clientMeta.platform) {
    throw new AppError('UNAUTHORIZED', 'Refresh token platform mismatch', 401);
  }

  const user = await assertActiveUser(session.userId);
  const { session: rotatedSession, refreshToken: newRefreshToken } = await rotateRefreshToken(
    session.id,
    session.expiresAt
  );

  const accessToken = await signAccessToken({
    userId: user.id,
    sessionId: rotatedSession.id,
    platform: clientMeta.platform,
    email: user.email,
  });

  return {
    accessToken,
    expiresIn: getAccessTokenTtlSeconds(),
    session: toSessionDto(rotatedSession),
    refreshToken: newRefreshToken,
    refreshExpiresAt: rotatedSession.expiresAt,
  };
}

export async function logout(sessionId: string): Promise<LogoutResponse> {
  await revokeSessionById(sessionId);
  return { success: true };
}

export async function logoutAll(userId: string, currentSessionId: string): Promise<LogoutAllResponse> {
  const revokedCount = await revokeAllExcept(userId, currentSessionId);
  return { revokedCount };
}

export async function listSessions(
  userId: string,
  currentSessionId: string
): Promise<SessionListResponse> {
  const sessions = await listActiveSessionsForUser(userId);
  return {
    sessions,
    currentSessionId,
  };
}

export async function revokeSession(
  targetSessionId: string,
  actorUserId: string,
  actorSessionId: string,
  actorIsTrusted: boolean
): Promise<RevokeSessionResponse> {
  if (targetSessionId === actorSessionId) {
    await revokeSessionById(targetSessionId);
    return { success: true };
  }

  if (!actorIsTrusted) {
    throw new AppError('FORBIDDEN', 'Trusted device required to revoke other sessions', 403);
  }

  const sessions = await listActiveSessionsForUser(actorUserId);
  const target = sessions.find((item) => item.id === targetSessionId);

  if (!target) {
    throw new AppError('NOT_FOUND', 'Session not found', 404);
  }

  await revokeSessionById(targetSessionId);
  return { success: true };
}

export async function trustSession(
  userId: string,
  sessionId: string,
  trust: boolean
): Promise<TrustSessionResponse> {
  const session = await updateSessionTrust(sessionId, userId, trust);
  return { session };
}
