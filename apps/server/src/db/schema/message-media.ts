import { index, pgTable, smallint, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { messages } from './messages';
import { uploads } from './uploads';

export const messageMedia = pgTable(
  'message_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    uploadId: uuid('upload_id')
      .notNull()
      .references(() => uploads.id),
    sortOrder: smallint('sort_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('message_media_message_upload_unique').on(table.messageId, table.uploadId),
    index('message_media_message_id_idx').on(table.messageId),
  ]
);

export type MessageMedia = typeof messageMedia.$inferSelect;
export type NewMessageMedia = typeof messageMedia.$inferInsert;
