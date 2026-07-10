import { and, desc, eq, sql } from 'drizzle-orm';
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
import type { AgentRunCallbacks, AgentToolCallResult } from '../../lib/agent-runtime/types';
import type {
  AiCursorQueryInput,
  CreateAiConversationInput,
  CreateAiMessageInput,
} from '../../schemas/ai';
import { getProfileByUserId, getUserById } from '../user-service';
import { listMemoriesForUser } from './memory-service';
import {
  loadRuntimeContext,
  maybeRefreshConversationSummary,
} from './summary-service';

const DEFAULT_AGENT = {
  slug: 'orbit-guide',
  name: '小轨',
  description:
    'Orbitchat 内置助手，支持闲聊、笑话、井字棋、平台资料查询、联系人搜索与写操作确认。',
  systemPrompt: `你是 Orbitchat 的内置 AI 助手小轨。

## 闲聊
你可以轻松闲聊、讲简短笑话，保持友好简洁。

## 平台助手
通过工具查询当前用户或他人的公开资料和近期帖子，帮用户搜索联系人。涉及个人资料、帖子、粉丝数等信息时，必须通过工具查询真实数据，不得编造。

## 游戏
与用户下井字棋（你执 O，用户执 X）。

## 写操作与记忆
在用户确认后执行发私信、发帖、关注/取关；在用户确认后记住偏好。在工具结果提供时，帮用户理解查询结果或待确认操作。`,
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
    .onConflictDoUpdate({
      target: agents.slug,
      set: {
        name: DEFAULT_AGENT.name,
        description: DEFAULT_AGENT.description,
        systemPrompt: DEFAULT_AGENT.systemPrompt,
      },
    });
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

export interface CreateAiMessageRunCallbacks {
  streamingMessageId: string;
  onDelta?: (delta: string) => void | Promise<void>;
  onToolStarted?: (toolName: string, input: unknown) => void | Promise<void>;
  onToolCall?: (toolCall: AgentToolCallResult) => void | Promise<void>;
}

export async function createAiMessageAndRun(input: {
  conversationId: string;
  userId: string;
  body: CreateAiMessageInput;
  orchestrator: AgentOrchestrator;
  stream?: CreateAiMessageRunCallbacks;
}): Promise<{
  userMessage: AiMessage;
  assistantMessage: AiMessage;
  toolCalls: AgentToolCallResult[];
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

  await maybeRefreshConversationSummary(input.conversationId);
  const { history, conversationSummary } = await loadRuntimeContext(input.conversationId);

  const [user, profile, memories] = await Promise.all([
    getUserById(input.userId),
    getProfileByUserId(input.userId),
    listMemoriesForUser(input.userId, { limit: 8 }),
  ]);

  const orchestratorCallbacks: AgentRunCallbacks | undefined = input.stream
    ? {
        onDelta: input.stream.onDelta,
        onToolStarted: input.stream.onToolStarted,
        onToolCall: input.stream.onToolCall,
      }
    : undefined;

  const result = await input.orchestrator.run(
    {
      systemPrompt: agent.systemPrompt,
      history,
      userMessage: input.body.content,
      conversationSummary,
      tools: true,
      toolContext: {
        conversationId: input.conversationId,
        userId: input.userId,
      },
      userContext: {
        username: user.username,
        displayName: profile.displayName,
      },
      memories: memories.map(({ kind, content }) => ({ kind, content })),
    },
    orchestratorCallbacks
  );

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
    toolCalls: result.toolCalls,
  };
}
