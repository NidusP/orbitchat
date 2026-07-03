import { check, index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const follows = pgTable(
  'follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followeeId: uuid('followee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('follows_follower_followee_unique').on(table.followerId, table.followeeId),
    check('follows_no_self_follow', sql`${table.followerId} <> ${table.followeeId}`),
    // Home feed fan-out: JOIN follows ON followee_id = posts.author_id WHERE follower_id = ?
    index('follows_follower_id_idx').on(table.followerId),
    // Followers list: WHERE followee_id = ?
    index('follows_followee_id_idx').on(table.followeeId),
  ]
);

export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;
