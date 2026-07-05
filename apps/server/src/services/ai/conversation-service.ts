import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type {
  Agent,
  AiConversation,
  AiMessage,
  CursorPage,
} from '@orbitchat/shared-types';
import { clampCursorLimit } from '@orbitchat/shared-types';
import { db } from '../../db';
import { agents } from '../../db/schema/agents';
import { aiConversations } from '../../db/schema/ai-conversations';
import { aiMessages } from '../../db/schema/ai-messages';
import { toAgentDto, toAiConversationDto, toAiMessageDto } from '../../lib/ai-mappers';
import {
  buildConversationListNextCursor,
  decodeConversationListCursor,
  type ConversationListCursor,
} from '../../lib/conversation-cursor';
import {
  buildNextCursor,
  decodeTimelineCursor,
  trimToPage,
  type TimelineCursor,
} from '../../lib/cursor';
import { AppError } from '../../lib/errors';
import type { AgentOrchestrator } from '../../lib/agent-runtime/orchestrator';
import type { LlmMessage } from '../../lib/agent-runtime/types';
import type {
  AiCursorQueryInput,
  CreateAiConversationInput,
  CreateAiMessageInput,
} from '../../schemas/ai';
import { runReadonlyTools } from './tool-executor';

const DEFAULT_AGENT = {
  slug: 'orbit-guide',
  name: '小轨',
  description: 'Orbitchat 内置助手，支持闲聊、笑话、小游戏和只读联系人搜索。',
  systemPrompt:
    '你是 Orbitchat 的内置 AI 助手小轨。你可以闲聊、讲简短笑话、玩文字版井字棋，并在工具结果提供时帮用户理解联系人搜索结果。',
};

function conversationListBefore(cursor: ConversationListCursor | undefined) {
  if (!cursor) {
    return undefined;
  }

  return sql`(COALESCE(${aiConversations.lastMessageAt}, ${aiConversations.updatedAt}), ${aiConversations.id}) < (${cursor.sortAt}::timestamptz, ${cursor.id}::uuid)`;
}

function messageTimelineBefore(cursor: TimelineCursor | undefined) {
  if (!cursor) {
    return undefined;
  }

  return sql`(${aiMessages.createdAt}, ${aiMessages.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
}

export async function ensureBuiltinAgents(): Promise<void> {
  await db
    .insert(agents)
    .values(DEFAULT_AGENT)
    .onConflictDoNothing({ target: agents.slug });
}

export async function listAgents(): Promise<Agent[]> {
  await ensureBuiltinAgents();
  const rows = await db.select().from(agents).orderBy(desc(agents.createdAt));
  return rows.map(toAgentDto);
}

async function getAgentById(agentId: string): Promise<typeof agents.$inferSelect> {
  await ensureBuiltinAgents();
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) {
    throw new AppError('NOT_FOUND', 'Agent not found', 404);
  }

  return agent;
}

async function assertAiConversationOwner(
  conversationId: string,
  userId: string
): Promise<typeof aiConversations.$inferSelect> {
  const conversation = await db.query.aiConversations.findFirst({
    where: and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)),
  });

  if (!conversation) {
    throw new AppError('NOT_FOUND', 'AI conversation not found', 404);
  }

  return conversation;
}

export async function listAiConversations(
  userId: string,
  params: AiCursorQueryInput
): Promise<CursorPage<AiConversation>> {
  const limit = clampCursorLimit(params.limit);
  const cursor = params.cursor ? decodeConversationListCursor(params.cursor) : undefined;

  const rows = await db
    .select({
      conversation: aiConversations,
      sortAt: sql<Date>`COALESCE(${aiConversations.lastMessageAt}, ${aiConversations.updatedAt})`.as(
        'sort_at'
      ),
    })
    .from(aiConversations)
    .where(and(eq(aiConversations.userId, userId), conversationListBefore(cursor)))
    .orderBy(
      desc(sql`COALESCE(${aiConversations.lastMessageAt}, ${aiConversations.updatedAt})`),
      desc(aiConversations.id)
    )
    .limit(limit + 1);

  const pageRows = trimToPage(rows, limit);
  const items = pageRows.map((row) => toAiConversationDto(row.conversation));
  const nextCursor = buildConversationListNextCursor(
    rows.map((row) => ({ id: row.conversation.id, sortAt: row.sortAt })),
    limit
  );

  return { items, nextCursor };
}

export async function createAiConversation(
  userId: string,
  input: CreateAiConversationInput
): Promise<AiConversation> {
  await getAgentById(input.agentId);

  const [created] = await db
    .insert(aiConversations)
    .values({
      userId,
      agentId: input.agentId,
      title: input.title,
    })
    .returning();

  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create AI conversation', 500);
  }

  return toAiConversationDto(created);
}

export async function listAiMessages(
  conversationId: string,
  userId: string,
  params: AiCursorQueryInput
): Promise<CursorPage<AiMessage>> {
  await assertAiConversationOwner(conversationId, userId);

  const limit = clampCursorLimit(params.limit);
  const cursor = params.cursor ? decodeTimelineCursor(params.cursor) : undefined;

  const rows = await db
    .select()
    .from(aiMessages)
    .where(
      and(eq(aiMessages.conversationId, conversationId), messageTimelineBefore(cursor))
    )
    .orderBy(desc(aiMessages.createdAt), desc(aiMessages.id))
    .limit(limit + 1);

  const pageRows = trimToPage(rows, limit);
  const nextCursor = buildNextCursor(rows, limit);

  return {
    items: pageRows.map(toAiMessageDto),
    nextCursor,
  };
}

async function loadRuntimeHistory(conversationId: string): Promise<LlmMessage[]> {
  const rows = await db
    .select()
    .from(aiMessages)
    .where(and(eq(aiMessages.conversationId, conversationId), isNull(aiMessages.toolName)))
    .orderBy(desc(aiMessages.createdAt), desc(aiMessages.id))
    .limit(20);

  return rows
    .reverse()
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export async function createAiMessageAndRun(input: {
  conversationId: string;
  userId: string;
  body: CreateAiMessageInput;
  orchestrator: AgentOrchestrator;
}): Promise<{
  userMessage: AiMessage;
  assistantMessage: AiMessage;
  toolCalls: Awaited<ReturnType<typeof runReadonlyTools>>['toolCalls'];
}> {
  const conversation = await assertAiConversationOwner(input.conversationId, input.userId);
  const agent = await getAgentById(conversation.agentId);
  const now = new Date();

  const [userMessage] = await db
    .insert(aiMessages)
    .values({
      conversationId: input.conversationId,
      role: 'user',
      content: input.body.content,
    })
    .returning();

  if (!userMessage) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create AI message', 500);
  }

  await db
    .update(aiConversations)
    .set({
      title: conversation.title ?? input.body.content.slice(0, 80),
      lastMessageAt: now,
      updatedAt: now,
    })
    .where(eq(aiConversations.id, input.conversationId));

  const [history, toolResult] = await Promise.all([
    loadRuntimeHistory(input.conversationId),
    runReadonlyTools(input.body.content, {
      conversationId: input.conversationId,
      userId: input.userId,
    }),
  ]);

  const result = await input.orchestrator.run({
    systemPrompt: agent.systemPrompt,
    history: [...history, ...toolResult.toolMessages],
    userMessage: input.body.content,
  });

  const assistantContent = result.content.trim();
  const [assistantMessage] = await db
    .insert(aiMessages)
    .values({
      conversationId: input.conversationId,
      role: 'assistant',
      content: assistantContent,
    })
    .returning();

  if (!assistantMessage) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create assistant message', 500);
  }

  await db
    .update(aiConversations)
    .set({
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiConversations.id, input.conversationId));

  return {
    userMessage: toAiMessageDto(userMessage),
    assistantMessage: toAiMessageDto(assistantMessage),
    toolCalls: [...toolResult.toolCalls, ...result.toolCalls],
  };
}
