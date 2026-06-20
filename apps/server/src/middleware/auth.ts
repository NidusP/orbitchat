import { createMiddleware } from 'hono/factory';
import { AppError } from '../lib/errors';
import { verifyAccessToken } from '../lib/jwt';
import { assertValidSession, touchSession } from '../services/session-service';

export interface AuthContext {
  userId: string;
  sessionId: string;
  isTrusted: boolean;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authorization = c.req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Missing or invalid Authorization header', 401);
  }

  const token = authorization.slice('Bearer '.length);

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

  await touchSession(session.id);

  c.set('auth', {
    userId: session.userId,
    sessionId: session.id,
    isTrusted: session.isTrusted,
  });

  await next();
});
