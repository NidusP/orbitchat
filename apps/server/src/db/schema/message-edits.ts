import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { messages } from './messages';
import { users } from './users';

export const messageEdits = pgTable(
  'message_edits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    editorUserId: uuid('editor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    previousContent: text('previous_content').notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('message_edits_message_timeline_idx').on(table.messageId, table.editedAt)]
);

export type MessageEdit = typeof messageEdits.$inferSelect;
export type NewMessageEdit = typeof messageEdits.$inferInsert;
