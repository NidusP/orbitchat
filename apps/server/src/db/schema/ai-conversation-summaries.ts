import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { aiConversations } from './ai-conversations';
import { aiMessages } from './ai-messages';

export const aiConversationSummaries = pgTable(
  'ai_conversation_summaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    summary: text('summary').notNull(),
    upToMessageId: uuid('up_to_message_id')
      .notNull()
      .references(() => aiMessages.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('ai_conversation_summaries_conversation_id_unique').on(table.conversationId),
  ]
);

export type AiConversationSummary = typeof aiConversationSummaries.$inferSelect;
export type NewAiConversationSummary = typeof aiConversationSummaries.$inferInsert;
