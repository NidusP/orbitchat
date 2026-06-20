import type { ClientPlatform } from '@orbitchat/shared-types';
import { isClientPlatform } from '@orbitchat/shared-types';
import { createMiddleware } from 'hono/factory';
import { AppError } from '../lib/errors';

export interface ClientMeta {
  platform: ClientPlatform;
  version: string;
  deviceId: string;
  requestId?: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    clientMeta: ClientMeta;
  }
}

export const clientMetaMiddleware = createMiddleware(async (c, next) => {
  const platform = c.req.header('X-Client-Platform');
  const version = c.req.header('X-Client-Version');
  const deviceId = c.req.header('X-Device-Id');
  const requestId = c.req.header('X-Request-Id');

  if (!platform || !isClientPlatform(platform)) {
    throw new AppError('VALIDATION_ERROR', 'Missing or invalid X-Client-Platform header', 400, {
      field: 'X-Client-Platform',
    });
  }

  if (!version) {
    throw new AppError('VALIDATION_ERROR', 'Missing X-Client-Version header', 400, {
      field: 'X-Client-Version',
    });
  }

  if (!deviceId) {
    throw new AppError('VALIDATION_ERROR', 'Missing X-Device-Id header', 400, {
      field: 'X-Device-Id',
    });
  }

  c.set('clientMeta', {
    platform,
    version,
    deviceId,
    requestId,
  });

  if (requestId) {
    c.header('X-Request-Id', requestId);
  }

  await next();
});
