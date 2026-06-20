import type { ApiResponse } from '@orbitchat/shared-types';
import { isSuccessResponse } from '@orbitchat/shared-types';
import { getDeviceId } from './device-id';
import { parseApiError } from './errors';

export type ApiV1Path = `/api/v1/${string}`;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}

function buildDefaultHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Client-Platform': 'web',
    'X-Client-Version': APP_VERSION,
    'X-Device-Id': getDeviceId(),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function refreshAccessToken(): Promise<string | null> {
  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: buildDefaultHeaders(),
    credentials: 'include',
  });

  const body = (await response.json()) as ApiResponse<{ accessToken: string }>;

  if (!isSuccessResponse(body)) {
    clearAccessToken();
    return null;
  }

  setAccessToken(body.data.accessToken);
  return body.data.accessToken;
}

async function refreshAccessTokenOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuthRetry?: boolean;
}

export async function apiRequest<T>(
  path: ApiV1Path,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { body, skipAuthRetry = false, headers, ...init } = options;

  const requestInit: RequestInit = {
    ...init,
    credentials: 'include',
    headers: {
      ...buildDefaultHeaders(),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let response = await fetch(`${API_BASE}${path}`, requestInit);
  let payload = (await response.json()) as ApiResponse<T>;

  if (
    !skipAuthRetry &&
    response.status === 401 &&
    !isSuccessResponse(payload) &&
    payload.code === 'UNAUTHORIZED' &&
    accessToken !== null
  ) {
    const newToken = await refreshAccessTokenOnce();

    if (newToken) {
      response = await fetch(`${API_BASE}${path}`, {
        ...requestInit,
        headers: {
          ...buildDefaultHeaders(),
          ...headers,
        },
      });
      payload = (await response.json()) as ApiResponse<T>;
    }
  }

  if (!isSuccessResponse(payload)) {
    throw parseApiError(payload, response.status);
  }

  return payload.data;
}

export { API_BASE };
