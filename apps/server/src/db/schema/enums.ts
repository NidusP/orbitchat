import { pgEnum } from 'drizzle-orm/pg-core';

export const clientPlatformEnum = pgEnum('client_platform', [
  'web',
  'ios',
  'android',
  'desktop',
]);

export type DbClientPlatform = (typeof clientPlatformEnum.enumValues)[number];
