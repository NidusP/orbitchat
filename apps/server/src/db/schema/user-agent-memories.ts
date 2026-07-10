import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { agents } from './agents';
import { aiConversations } from './ai-conversations';
import { users } from './users';

export const userAgentMemories = pgTable(
  'user_agent_memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    kind: varchar('kind', { length: 32 }).notNull(),
    content: text('content').notNull(),
    source: varchar('source', { length: 32 }).notNull(),
    conversationId: uuid('conversation_id').references(() => aiConversations.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('user_agent_memories_user_deleted_idx').on(table.userId, table.deletedAt)]
);

export type UserAgentMemory = typeof userAgentMemories.$inferSelect;
export type NewUserAgentMemory = typeof userAgentMemories.$inferInsert;
