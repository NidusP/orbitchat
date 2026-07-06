import { and, desc, eq, sql } from 'drizzle-orm';
import type { AiToolCall, CursorPage } from '@orbitchat/shared-types';
import { clampCursorLimit } from '@orbitchat/shared-types';
import { db } from '../../db';
import { aiConversations } from '../../db/schema/ai-conversations';
import { aiToolCalls } from '../../db/schema/ai-tool-calls';
import { toAiToolCallDto } from '../../lib/ai-mappers';
import {
  buildNextCursor,
  decodeTimelineCursor,
  trimToPage,
  type TimelineCursor,
} from '../../lib/cursor';
import { AppError } from '../../lib/errors';
import type { AiCursorQueryInput } from '../../schemas/ai';
import { createOrGetDirectConversation } from '../conversation-service';
import { createMessage as createChatMessage } from '../message-service';

interface SendDmInput {
  targetUserId: string;
  targetUsername: string;
  content: string;
}

function toolCallTimelineBefore(cursor: TimelineCursor | undefined) {
  if (!cursor) {
    return undefined;
  }

  return sql`(${aiToolCalls.createdAt}, ${aiToolCalls.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
}

function isSendDmInput(input: unknown): input is SendDmInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'targetUserId' in input &&
    'targetUsername' in input &&
    'content' in input &&
    typeof input.targetUserId === 'string' &&
    typeof input.targetUsername === 'string' &&
    typeof input.content === 'string'
  );
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

async function getOwnedToolCall(
  toolCallId: string,
  userId: string
): Promise<typeof aiToolCalls.$inferSelect> {
  const row = await db
    .select({ toolCall: aiToolCalls })
    .from(aiToolCalls)
    .innerJoin(aiConversations, eq(aiConversations.id, aiToolCalls.conversationId))
    .where(and(eq(aiToolCalls.id, toolCallId), eq(aiConversations.userId, userId)))
    .limit(1);

  const toolCall = row[0]?.toolCall;
  if (!toolCall) {
    throw new AppError('NOT_FOUND', 'AI tool call not found', 404);
  }

  return toolCall;
}

export async function createPendingSendDmToolCall(input: {
  conversationId: string;
  userId: string;
  targetUserId: string;
  targetUsername: string;
  content: string;
}): Promise<AiToolCall> {
  await assertAiConversationOwner(input.conversationId, input.userId);

  const [created] = await db
    .insert(aiToolCalls)
    .values({
      conversationId: input.conversationId,
      requestedByUserId: input.userId,
      toolName: 'send_dm',
      input: {
        targetUserId: input.targetUserId,
        targetUsername: input.targetUsername,
        content: input.content,
      } satisfies SendDmInput,
    })
    .returning();

  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create AI tool call', 500);
  }

  return toAiToolCallDto(created);
}

export async function listAiToolCalls(
  conversationId: string,
  userId: string,
  params: AiCursorQueryInput
): Promise<CursorPage<AiToolCall>> {
  await assertAiConversationOwner(conversationId, userId);

  const limit = clampCursorLimit(params.limit);
  const cursor = params.cursor ? decodeTimelineCursor(params.cursor) : undefined;

  const rows = await db
    .select()
    .from(aiToolCalls)
    .where(and(eq(aiToolCalls.conversationId, conversationId), toolCallTimelineBefore(cursor)))
    .orderBy(desc(aiToolCalls.createdAt), desc(aiToolCalls.id))
    .limit(limit + 1);

  return {
    items: trimToPage(rows, limit).map(toAiToolCallDto),
    nextCursor: buildNextCursor(rows, limit),
  };
}

export async function rejectAiToolCall(toolCallId: string, userId: string): Promise<AiToolCall> {
  const toolCall = await getOwnedToolCall(toolCallId, userId);
  if (toolCall.status !== 'pending') {
    throw new AppError('VALIDATION_ERROR', 'Only pending tool calls can be rejected', 400);
  }

  const now = new Date();
  const [updated] = await db
    .update(aiToolCalls)
    .set({
      status: 'rejected',
      confirmedAt: now,
      updatedAt: now,
    })
    .where(eq(aiToolCalls.id, toolCallId))
    .returning();

  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Failed to reject AI tool call', 500);
  }

  return toAiToolCallDto(updated);
}

export async function approveAiToolCall(toolCallId: string, userId: string): Promise<AiToolCall> {
  const toolCall = await getOwnedToolCall(toolCallId, userId);
  if (toolCall.status !== 'pending') {
    throw new AppError('VALIDATION_ERROR', 'Only pending tool calls can be approved', 400);
  }
  if (toolCall.toolName !== 'send_dm' || !isSendDmInput(toolCall.input)) {
    throw new AppError('VALIDATION_ERROR', 'Unsupported AI tool call', 400);
  }

  const now = new Date();
  const [approved] = await db
    .update(aiToolCalls)
    .set({
      status: 'approved',
      confirmedAt: now,
      updatedAt: now,
    })
    .where(eq(aiToolCalls.id, toolCallId))
    .returning();

  if (!approved) {
    throw new AppError('INTERNAL_ERROR', 'Failed to approve AI tool call', 500);
  }

  try {
    const direct = await createOrGetDirectConversation(userId, {
      participantUserId: toolCall.input.targetUserId,
    });
    const message = await createChatMessage(direct.conversation.id, userId, {
      content: toolCall.input.content,
    });

    const [executed] = await db
      .update(aiToolCalls)
      .set({
        status: 'executed',
        output: {
          conversationId: direct.conversation.id,
          messageId: message.id,
          targetUserId: toolCall.input.targetUserId,
          targetUsername: toolCall.input.targetUsername,
        },
        executedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiToolCalls.id, toolCallId))
      .returning();

    if (!executed) {
      throw new AppError('INTERNAL_ERROR', 'Failed to update AI tool call', 500);
    }

    return toAiToolCallDto(executed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute AI tool call';
    const [failed] = await db
      .update(aiToolCalls)
      .set({
        status: 'failed',
        error: message,
        updatedAt: new Date(),
      })
      .where(eq(aiToolCalls.id, toolCallId))
      .returning();

    if (!failed) {
      throw new AppError('INTERNAL_ERROR', 'Failed to update AI tool call failure', 500);
    }

    return toAiToolCallDto(failed);
  }
}
