import type { ApiResponse, CreateUploadResponse, UploadPurpose } from '@orbitchat/shared-types';
import { isSuccessResponse } from '@orbitchat/shared-types';
import { API_BASE, buildDefaultHeaders, clearAccessToken, getAccessToken, setAccessToken } from './client';
import { parseApiError } from './errors';

let refreshPromise: Promise<string | null> | null = null;

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

export async function uploadFile(
  file: File,
  purpose: UploadPurpose
): Promise<CreateUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', purpose);

  const requestInit: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: buildDefaultHeaders(),
    body: formData,
  };

  let response = await fetch(`${API_BASE}/api/v1/uploads`, requestInit);
  let payload = (await response.json()) as ApiResponse<CreateUploadResponse>;

  if (
    response.status === 401 &&
    !isSuccessResponse(payload) &&
    payload.code === 'UNAUTHORIZED' &&
    getAccessToken() !== null
  ) {
    const newToken = await refreshAccessTokenOnce();

    if (newToken) {
      response = await fetch(`${API_BASE}/api/v1/uploads`, {
        ...requestInit,
        headers: buildDefaultHeaders(),
      });
      payload = (await response.json()) as ApiResponse<CreateUploadResponse>;
    }
  }

  if (!isSuccessResponse(payload)) {
    throw parseApiError(payload, response.status);
  }

  return payload.data;
}
