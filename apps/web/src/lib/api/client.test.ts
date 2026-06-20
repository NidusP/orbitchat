import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { ApiResponse } from '@orbitchat/shared-types';
import { refresh, logout } from './auth';
import { apiRequest, clearAccessToken, getAccessToken, setAccessToken } from './client';

function jsonResponse<T>(status: number, body: ApiResponse<T>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('api client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearAccessToken();
    mock.restore();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('does not send Content-Type when request body is absent', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        code: 'SUCCESS',
        data: { ok: true },
        timestamp: new Date().toISOString(),
      })
    );

    await apiRequest<{ ok: boolean }>('/api/v1/users/test-user');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get('Content-Type')).toBeNull();
  });

  test('refresh stores the new access token', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        code: 'SUCCESS',
        data: {
          accessToken: 'fresh-access-token',
          expiresIn: 900,
          session: {
            id: 'session-1',
            userId: 'user-1',
            deviceId: 'device-1',
            platform: 'web',
            deviceName: 'Chrome',
            isTrusted: false,
            lastActiveAt: '2026-06-16T00:00:00.000Z',
            expiresAt: '2026-07-16T00:00:00.000Z',
            createdAt: '2026-06-16T00:00:00.000Z',
          },
        },
        timestamp: new Date().toISOString(),
      })
    );

    const result = await refresh();

    expect(result.accessToken).toBe('fresh-access-token');
    expect(getAccessToken()).toBe('fresh-access-token');
    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get('Content-Type')).toBeNull();
  });

  test('logout refreshes an expired access token before retrying', async () => {
    setAccessToken('stale-access-token');

    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url.endsWith('/api/v1/auth/logout')) {
          const authorization = new Headers(init?.headers).get('Authorization');

          if (authorization === 'Bearer stale-access-token') {
            return jsonResponse(401, {
              code: 'UNAUTHORIZED',
              message: 'Invalid or expired access token',
              timestamp: new Date().toISOString(),
            });
          }

          if (authorization === 'Bearer fresh-access-token') {
            return jsonResponse(200, {
              code: 'SUCCESS',
              data: { success: true },
              timestamp: new Date().toISOString(),
            });
          }
        }

        if (url.endsWith('/api/v1/auth/refresh')) {
          return jsonResponse(200, {
            code: 'SUCCESS',
            data: {
              accessToken: 'fresh-access-token',
              expiresIn: 900,
              session: {
                id: 'session-1',
                userId: 'user-1',
                deviceId: 'device-1',
                platform: 'web',
                deviceName: 'Chrome',
                isTrusted: false,
                lastActiveAt: '2026-06-16T00:00:00.000Z',
                expiresAt: '2026-07-16T00:00:00.000Z',
                createdAt: '2026-06-16T00:00:00.000Z',
              },
            },
            timestamp: new Date().toISOString(),
          });
        }

        throw new Error(`Unexpected fetch call: ${url}`);
      }
    );

    const result = await logout();

    expect(result).toEqual({ success: true });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBeNull();
  });
});
