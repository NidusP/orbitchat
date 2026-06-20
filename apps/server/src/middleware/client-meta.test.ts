import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { handleError } from './error';
import { clientMetaMiddleware } from './client-meta';

function createApp(): Hono {
  const app = new Hono();
  app.use('*', clientMetaMiddleware);
  app.get('/meta', (c) => c.json(c.get('clientMeta')));
  app.onError((error, c) => handleError(error, c));
  return app;
}

describe('clientMetaMiddleware', () => {
  test('rejects requests without required client headers', async () => {
    const app = createApp();

    const response = await app.request('/meta');
    const body = (await response.json()) as { code: string; details?: { field?: string } };

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details?.field).toBe('X-Client-Platform');
  });

  test('captures client metadata and echoes request id', async () => {
    const app = createApp();

    const response = await app.request('/meta', {
      headers: {
        'X-Client-Platform': 'web',
        'X-Client-Version': '1.2.3',
        'X-Device-Id': 'device-123',
        'X-Request-Id': 'request-123',
      },
    });
    const body = (await response.json()) as {
      platform: string;
      version: string;
      deviceId: string;
      requestId?: string;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Request-Id')).toBe('request-123');
    expect(body).toEqual({
      platform: 'web',
      version: '1.2.3',
      deviceId: 'device-123',
      requestId: 'request-123',
    });
  });
});
