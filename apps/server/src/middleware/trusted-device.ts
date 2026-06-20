import { createMiddleware } from 'hono/factory';
import { AppError } from '../lib/errors';

export const trustedDeviceMiddleware = createMiddleware(async (c, next) => {
  const auth = c.get('auth');

  if (!auth.isTrusted) {
    throw new AppError('FORBIDDEN', 'Trusted device required', 403);
  }

  await next();
});
