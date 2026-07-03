import { index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { posts } from './posts';
import { users } from './users';

export const likes = pgTable(
  'likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One like per user per post — also serves WHERE user_id = ? AND post_id = ?
    unique('likes_user_post_unique').on(table.userId, table.postId),
    index('likes_post_id_idx').on(table.postId),
  ]
);

export type Like = typeof likes.$inferSelect;
export type NewLike = typeof likes.$inferInsert;
