import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { isProduction } from '../env';

export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function setRefreshCookie(c: Context, token: string, expiresAt: Date): void {
  setCookie(c, REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(c: Context): void {
  deleteCookie(c, REFRESH_COOKIE_NAME, {
    path: REFRESH_COOKIE_PATH,
  });
}

export function getRefreshTokenFromCookie(c: Context): string | undefined {
  return getCookie(c, REFRESH_COOKIE_NAME);
}
