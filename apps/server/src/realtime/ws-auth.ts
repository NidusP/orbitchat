import type { Context } from 'hono';
import { isClientPlatform, type ClientPlatform } from '@orbitchat/shared-types';
import { AppError } from '../lib/errors';
import { verifyAccessToken } from '../lib/jwt';
import type { AuthContext } from '../middleware/auth';
import { assertValidSession } from '../services/session-service';

export async function authenticateChatWs(
  c: Context
): Promise<AuthContext & { deviceId: string; platform: ClientPlatform }> {
  const token = c.req.query('token');

  if (!token) {
    throw new AppError('UNAUTHORIZED', 'Missing access token', 401);
  }

  const deviceId = c.req.header('X-Device-Id') ?? c.req.query('deviceId');
  if (!deviceId) {
    throw new AppError('UNAUTHORIZED', 'Missing X-Device-Id header or deviceId query', 401);
  }

  const platformRaw = c.req.header('X-Client-Platform') ?? c.req.query('platform');
  if (!platformRaw || !isClientPlatform(platformRaw)) {
    throw new AppError(
      'UNAUTHORIZED',
      'Missing or invalid X-Client-Platform header or platform query',
      401
    );
  }

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired access token', 401);
  }

  const session = await assertValidSession(payload.sid);

  if (session.userId !== payload.sub) {
    throw new AppError('UNAUTHORIZED', 'Session does not match token subject', 401);
  }

  if (session.platform !== payload.platform) {
    throw new AppError('UNAUTHORIZED', 'Session platform mismatch', 401);
  }

  if (session.deviceId !== deviceId) {
    throw new AppError('UNAUTHORIZED', 'Device id mismatch', 401);
  }

  return {
    userId: session.userId,
    sessionId: session.id,
    isTrusted: session.isTrusted,
    deviceId,
    platform: platformRaw,
  };
}
