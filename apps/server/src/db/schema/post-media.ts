import { index, pgTable, smallint, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { posts } from './posts';
import { uploads } from './uploads';

export const postMedia = pgTable(
  'post_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    uploadId: uuid('upload_id')
      .notNull()
      .references(() => uploads.id),
    sortOrder: smallint('sort_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('post_media_post_upload_unique').on(table.postId, table.uploadId),
    index('post_media_post_id_idx').on(table.postId),
  ]
);

export type PostMedia = typeof postMedia.$inferSelect;
export type NewPostMedia = typeof postMedia.$inferInsert;
