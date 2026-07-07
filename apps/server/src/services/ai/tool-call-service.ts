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
import { followUser, unfollowUser } from '../follow-service';
import { createOrGetDirectConversation } from '../conversation-service';
import { createMessage as createChatMessage } from '../message-service';
import { createPost } from '../post-service';

interface SendDmInput {
  targetUserId: string;
  targetUsername: string;
  content: string;
}

interface CreatePostInput {
  content: string;
}

interface FollowUserInput {
  targetUserId: string;
  targetUsername: string;
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

function isCreatePostInput(input: unknown): input is CreatePostInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'content' in input &&
    typeof input.content === 'string'
  );
}

function isFollowUserInput(input: unknown): input is FollowUserInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'targetUserId' in input &&
    'targetUsername' in input &&
    typeof input.targetUserId === 'string' &&
    typeof input.targetUsername === 'string'
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

async function createPendingToolCall(input: {
  conversationId: string;
  userId: string;
  toolName: string;
  payload: unknown;
}): Promise<AiToolCall> {
  await assertAiConversationOwner(input.conversationId, input.userId);

  const [created] = await db
    .insert(aiToolCalls)
    .values({
      conversationId: input.conversationId,
      requestedByUserId: input.userId,
      toolName: input.toolName,
      input: input.payload,
    })
    .returning();

  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create AI tool call', 500);
  }

  return toAiToolCallDto(created);
}

async function markToolCallExecuted(
  toolCallId: string,
  output: unknown
): Promise<AiToolCall> {
  const [executed] = await db
    .update(aiToolCalls)
    .set({
      status: 'executed',
      output,
      executedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiToolCalls.id, toolCallId))
    .returning();

  if (!executed) {
    throw new AppError('INTERNAL_ERROR', 'Failed to update AI tool call', 500);
  }

  return toAiToolCallDto(executed);
}

async function markToolCallFailed(toolCallId: string, message: string): Promise<AiToolCall> {
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

export async function createPendingSendDmToolCall(input: {
  conversationId: string;
  userId: string;
  targetUserId: string;
  targetUsername: string;
  content: string;
}): Promise<AiToolCall> {
  return createPendingToolCall({
    conversationId: input.conversationId,
    userId: input.userId,
    toolName: 'send_dm',
    payload: {
      targetUserId: input.targetUserId,
      targetUsername: input.targetUsername,
      content: input.content,
    } satisfies SendDmInput,
  });
}

export async function createPendingCreatePostToolCall(input: {
  conversationId: string;
  userId: string;
  content: string;
}): Promise<AiToolCall> {
  return createPendingToolCall({
    conversationId: input.conversationId,
    userId: input.userId,
    toolName: 'create_post',
    payload: {
      content: input.content,
    } satisfies CreatePostInput,
  });
}

export async function createPendingFollowUserToolCall(input: {
  conversationId: string;
  userId: string;
  targetUserId: string;
  targetUsername: string;
}): Promise<AiToolCall> {
  return createPendingToolCall({
    conversationId: input.conversationId,
    userId: input.userId,
    toolName: 'follow_user',
    payload: {
      targetUserId: input.targetUserId,
      targetUsername: input.targetUsername,
    } satisfies FollowUserInput,
  });
}

export async function createPendingUnfollowUserToolCall(input: {
  conversationId: string;
  userId: string;
  targetUserId: string;
  targetUsername: string;
}): Promise<AiToolCall> {
  return createPendingToolCall({
    conversationId: input.conversationId,
    userId: input.userId,
    toolName: 'unfollow_user',
    payload: {
      targetUserId: input.targetUserId,
      targetUsername: input.targetUsername,
    } satisfies FollowUserInput,
  });
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

async function executeSendDmToolCall(
  toolCallId: string,
  userId: string,
  input: SendDmInput
): Promise<AiToolCall> {
  const direct = await createOrGetDirectConversation(userId, {
    participantUserId: input.targetUserId,
  });
  const message = await createChatMessage(direct.conversation.id, userId, {
    content: input.content,
  });

  return markToolCallExecuted(toolCallId, {
    conversationId: direct.conversation.id,
    messageId: message.id,
    targetUserId: input.targetUserId,
    targetUsername: input.targetUsername,
  });
}

async function executeCreatePostToolCall(
  toolCallId: string,
  userId: string,
  input: CreatePostInput
): Promise<AiToolCall> {
  const post = await createPost(userId, { content: input.content });
  return markToolCallExecuted(toolCallId, {
    postId: post.id,
    content: post.content,
  });
}

async function executeFollowUserToolCall(
  toolCallId: string,
  userId: string,
  input: FollowUserInput
): Promise<AiToolCall> {
  const result = await followUser(userId, input.targetUserId);
  return markToolCallExecuted(toolCallId, {
    targetUserId: input.targetUserId,
    targetUsername: input.targetUsername,
    following: result.following,
  });
}

async function executeUnfollowUserToolCall(
  toolCallId: string,
  userId: string,
  input: FollowUserInput
): Promise<AiToolCall> {
  const result = await unfollowUser(userId, input.targetUserId);
  return markToolCallExecuted(toolCallId, {
    targetUserId: input.targetUserId,
    targetUsername: input.targetUsername,
    following: result.following,
  });
}

export async function approveAiToolCall(toolCallId: string, userId: string): Promise<AiToolCall> {
  const toolCall = await getOwnedToolCall(toolCallId, userId);
  if (toolCall.status !== 'pending') {
    throw new AppError('VALIDATION_ERROR', 'Only pending tool calls can be approved', 400);
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
    switch (toolCall.toolName) {
      case 'send_dm':
        if (!isSendDmInput(toolCall.input)) {
          throw new AppError('VALIDATION_ERROR', 'Invalid send_dm tool input', 400);
        }
        return executeSendDmToolCall(toolCallId, userId, toolCall.input);
      case 'create_post':
        if (!isCreatePostInput(toolCall.input)) {
          throw new AppError('VALIDATION_ERROR', 'Invalid create_post tool input', 400);
        }
        return executeCreatePostToolCall(toolCallId, userId, toolCall.input);
      case 'follow_user':
        if (!isFollowUserInput(toolCall.input)) {
          throw new AppError('VALIDATION_ERROR', 'Invalid follow_user tool input', 400);
        }
        return executeFollowUserToolCall(toolCallId, userId, toolCall.input);
      case 'unfollow_user':
        if (!isFollowUserInput(toolCall.input)) {
          throw new AppError('VALIDATION_ERROR', 'Invalid unfollow_user tool input', 400);
        }
        return executeUnfollowUserToolCall(toolCallId, userId, toolCall.input);
      default:
        throw new AppError('VALIDATION_ERROR', 'Unsupported AI tool call', 400);
    }
  } catch (error) {
    if (error instanceof AppError && error.statusCode < 500) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Failed to execute AI tool call';
    return markToolCallFailed(toolCallId, message);
  }
}
