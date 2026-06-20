import type { ClientPlatform } from '@orbitchat/shared-types';
import { sign, verify } from 'hono/jwt';
import { env } from '../env';
import { parseTtlSeconds } from './ttl';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  platform: ClientPlatform;
  email: string;
  exp: number;
}

export function getAccessTokenTtlSeconds(): number {
  return parseTtlSeconds(env.JWT_ACCESS_TTL);
}

export async function signAccessToken(payload: {
  userId: string;
  sessionId: string;
  platform: ClientPlatform;
  email: string;
}): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + getAccessTokenTtlSeconds();

  return sign(
    {
      sub: payload.userId,
      sid: payload.sessionId,
      platform: payload.platform,
      email: payload.email,
      exp,
    },
    env.JWT_SECRET
  );
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const payload = await verify(token, env.JWT_SECRET, 'HS256');

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.sid !== 'string' ||
    typeof payload.platform !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    throw new Error('Invalid access token payload');
  }

  return {
    sub: payload.sub,
    sid: payload.sid,
    platform: payload.platform as ClientPlatform,
    email: payload.email,
    exp: payload.exp,
  };
}
