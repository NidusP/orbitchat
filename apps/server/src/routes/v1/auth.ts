import type { Context } from 'hono';
import type { ClientPlatform } from '@orbitchat/shared-types';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import {
  clearRefreshCookie,
  getRefreshTokenFromCookie,
  setRefreshCookie,
} from '../../lib/cookies';
import { AppError } from '../../lib/errors';
import { readOptionalJsonBody } from '../../lib/request';
import { successResponse } from '../../lib/response';
import { parseUuidParam, validationErrorFromZod } from '../../lib/validation';
import { zodValidationHook } from '../../lib/zod-hook';
import { authMiddleware } from '../../middleware/auth';
import { trustedDeviceMiddleware } from '../../middleware/trusted-device';
import type { AuthTokenBundle } from '../../services/auth-service';
import {
  listSessions,
  login,
  logout,
  logoutAll,
  refreshSession,
  register,
  revokeSession,
  trustSession,
} from '../../services/auth-service';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  trustSessionSchema,
} from '../../schemas/auth';

export const authRouter = new Hono();

function isWebPlatform(platform: ClientPlatform): boolean {
  return platform === 'web';
}

function attachRefreshCookieIfWeb(
  c: Context,
  platform: ClientPlatform,
  tokens: AuthTokenBundle
) {
  if (isWebPlatform(platform)) {
    setRefreshCookie(c, tokens.refreshToken, tokens.refreshExpiresAt);
  }
}

function stripRefreshToken<T extends AuthTokenBundle>(payload: T) {
  const { refreshToken: _refreshToken, refreshExpiresAt: _refreshExpiresAt, ...rest } = payload;
  return rest;
}

function resolveRefreshToken(
  c: Context,
  bodyRefreshToken?: string
): string {
  const cookieToken = getRefreshTokenFromCookie(c);
  const refreshToken = cookieToken ?? bodyRefreshToken;

  if (!refreshToken) {
    throw new AppError('UNAUTHORIZED', 'Refresh token required', 401);
  }

  return refreshToken;
}

authRouter.post('/register', zValidator('json', registerSchema, zodValidationHook), async (c) => {
  const input = c.req.valid('json');
  const result = await register(input);
  return c.json(successResponse(result), 201);
});

authRouter.post('/login', zValidator('json', loginSchema, zodValidationHook), async (c) => {
  const input = c.req.valid('json');
  const clientMeta = c.get('clientMeta');
  const result = await login(input, clientMeta);

  attachRefreshCookieIfWeb(c, clientMeta.platform, result);

  const data = isWebPlatform(clientMeta.platform)
    ? stripRefreshToken(result)
    : { ...stripRefreshToken(result), refreshToken: result.refreshToken };

  return c.json(successResponse(data), 200);
});

authRouter.post('/refresh', async (c) => {
  const clientMeta = c.get('clientMeta');
  let bodyRefreshToken: string | undefined;

  const raw = await readOptionalJsonBody<unknown>(c.req);
  if (raw !== undefined) {
    const parsed = refreshSchema.safeParse(raw);
    if (!parsed.success) {
      throw validationErrorFromZod(parsed.error);
    }
    bodyRefreshToken = parsed.data.refreshToken;
  }

  const refreshToken = resolveRefreshToken(c, bodyRefreshToken);
  const result = await refreshSession(refreshToken, clientMeta);

  attachRefreshCookieIfWeb(c, clientMeta.platform, result);

  const data = isWebPlatform(clientMeta.platform)
    ? stripRefreshToken(result)
    : { ...stripRefreshToken(result), refreshToken: result.refreshToken };

  return c.json(successResponse(data), 200);
});

authRouter.delete('/logout', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const clientMeta = c.get('clientMeta');
  const result = await logout(auth.sessionId);

  if (isWebPlatform(clientMeta.platform)) {
    clearRefreshCookie(c);
  }

  return c.json(successResponse(result), 200);
});

authRouter.post('/logout-all', authMiddleware, trustedDeviceMiddleware, async (c) => {
  const auth = c.get('auth');
  const result = await logoutAll(auth.userId, auth.sessionId);
  return c.json(successResponse(result), 200);
});

authRouter.get('/sessions', authMiddleware, trustedDeviceMiddleware, async (c) => {
  const auth = c.get('auth');
  const result = await listSessions(auth.userId, auth.sessionId);
  return c.json(successResponse(result), 200);
});

authRouter.delete('/sessions/:sessionId', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const sessionId = parseUuidParam(c.req.param('sessionId'), 'sessionId', 'Invalid session id');
  const result = await revokeSession(sessionId, auth.userId, auth.sessionId, auth.isTrusted);

  if (sessionId === auth.sessionId) {
    const clientMeta = c.get('clientMeta');
    if (isWebPlatform(clientMeta.platform)) {
      clearRefreshCookie(c);
    }
  }

  return c.json(successResponse(result), 200);
});

authRouter.post('/sessions/trust', authMiddleware, zValidator('json', trustSessionSchema, zodValidationHook), async (c) => {
  const auth = c.get('auth');
  const input = c.req.valid('json');
  const result = await trustSession(auth.userId, auth.sessionId, input.trust);
  return c.json(successResponse(result), 200);
});
