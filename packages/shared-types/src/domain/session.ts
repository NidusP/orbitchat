import type { ClientPlatform } from './client';

/**
 * Active user session (API DTO — no refresh token hash).
 */
export interface UserSession {
  id: string;
  userId: string;
  deviceId: string;
  platform: ClientPlatform;
  deviceName: string | null;
  isTrusted: boolean;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
}
