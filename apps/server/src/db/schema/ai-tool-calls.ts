import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { aiToolCallStatusEnum } from './enums';
import { aiConversations } from './ai-conversations';
import { users } from './users';

export const aiToolCalls = pgTable(
  'ai_tool_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    requestedByUserId: uuid('requested_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toolName: varchar('tool_name', { length: 64 }).notNull(),
    status: aiToolCallStatusEnum('status').notNull().default('pending'),
    input: jsonb('input').notNull(),
    output: jsonb('output'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    executedAt: timestamp('executed_at', { withTimezone: true }),
  },
  (table) => [
    index('ai_tool_calls_conversation_created_idx').on(table.conversationId, table.createdAt),
    index('ai_tool_calls_user_status_idx').on(table.requestedByUserId, table.status),
  ]
);

export type AiToolCall = typeof aiToolCalls.$inferSelect;
export type NewAiToolCall = typeof aiToolCalls.$inferInsert;
