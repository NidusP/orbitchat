/**
 * Client platform enum shared across API, DB, and clients.
 */
export const CLIENT_PLATFORMS = ['web', 'ios', 'android', 'desktop'] as const;

export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];

export function isClientPlatform(value: string): value is ClientPlatform {
  return CLIENT_PLATFORMS.includes(value as ClientPlatform);
}
