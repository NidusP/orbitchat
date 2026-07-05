import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { aiMessageRoleEnum } from './enums';
import { aiConversations } from './ai-conversations';

export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: aiMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    toolName: varchar('tool_name', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_messages_conversation_created_idx').on(table.conversationId, table.createdAt),
  ]
);

export type AiMessage = typeof aiMessages.$inferSelect;
export type NewAiMessage = typeof aiMessages.$inferInsert;
