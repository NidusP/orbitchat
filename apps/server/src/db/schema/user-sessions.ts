import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { clientPlatformEnum } from './enums';
import { users } from './users';

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: varchar('device_id', { length: 64 }).notNull(),
    platform: clientPlatformEnum('platform').notNull(),
    deviceName: varchar('device_name', { length: 128 }),
    isTrusted: boolean('is_trusted').notNull().default(false),
    refreshTokenHash: varchar('refresh_token_hash', { length: 128 }).notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('user_sessions_user_id_active_idx')
      .on(table.userId)
      .where(sql`${table.revokedAt} IS NULL`),
  ]
);

export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
