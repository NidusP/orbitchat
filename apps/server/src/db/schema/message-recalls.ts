import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { conversations } from './conversations';
import { messages } from './messages';
import { users } from './users';

export const messageRecalls = pgTable(
  'message_recalls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    recalledByUserId: uuid('recalled_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    messageCreatedAt: timestamp('message_created_at', { withTimezone: true }).notNull(),
    recalledAt: timestamp('recalled_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('message_recalls_message_id_unique').on(table.messageId),
    index('message_recalls_conversation_timeline_idx').on(
      table.conversationId,
      table.messageCreatedAt,
      table.id
    ),
  ]
);

export type MessageRecall = typeof messageRecalls.$inferSelect;
export type NewMessageRecall = typeof messageRecalls.$inferInsert;
