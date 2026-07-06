import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { CursorPage, Message } from '@orbitchat/shared-types';
import { db } from '../db';
import { conversationMembers } from '../db/schema/conversation-members';
import { conversations } from '../db/schema/conversations';
import { messages } from '../db/schema/messages';
import { loadParticipantSummaries } from '../lib/conversation-loaders';
import { toMessage } from '../lib/conversation-mappers';
import {
  buildNextCursor,
  decodeTimelineCursor,
  trimToPage,
  type TimelineCursor,
} from '../lib/cursor';
import { AppError } from '../lib/errors';
import { broadcastMessageNew, broadcastMessageRead } from '../realtime/chat-hub';
import type {
  CreateMessageInput,
  MarkConversationReadInput,
  MessageCursorQueryInput,
} from '../schemas/conversations';
import { clampMessageLimit } from '../schemas/conversations';
import { assertConversationMember } from './conversation-service';

function messageTimelineBefore(cursor: TimelineCursor | undefined) {
  if (!cursor) {
    return undefined;
  }

  return sql`(${messages.createdAt}, ${messages.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
}

async function toMessageDto(row: typeof messages.$inferSelect): Promise<Message> {
  const senders = await loadParticipantSummaries([row.senderId]);
  const sender = senders.get(row.senderId);
  if (!sender) {
    throw new AppError('NOT_FOUND', 'Sender not found', 404);
  }
  return toMessage(row, sender);
}

export async function listMessages(
  conversationId: string,
  viewerId: string,
  params: MessageCursorQueryInput
): Promise<CursorPage<Message>> {
  await assertConversationMember(conversationId, viewerId);

  const limit = clampMessageLimit(params.limit);
  const cursor = params.cursor ? decodeTimelineCursor(params.cursor) : undefined;

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        isNull(messages.deletedAt),
        messageTimelineBefore(cursor)
      )
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit + 1);

  const pageRows = trimToPage(rows, limit);
  const senderIds = pageRows.map((row) => row.senderId);
  const senders = await loadParticipantSummaries(senderIds);

  const items = pageRows.map((row) => {
    const sender = senders.get(row.senderId);
    if (!sender) {
      throw new AppError('NOT_FOUND', 'Sender not found', 404);
    }
    return toMessage(row, sender);
  });

  const nextCursor = buildNextCursor(rows, limit);
  return { items, nextCursor };
}

export async function createMessage(
  conversationId: string,
  senderId: string,
  input: CreateMessageInput
): Promise<Message> {
  await assertConversationMember(conversationId, senderId);

  const now = new Date();

  const created = await db.transaction(async (tx) => {
    const [message] = await tx
      .insert(messages)
      .values({
        conversationId,
        senderId,
        content: input.content,
      })
      .returning();

    if (!message) {
      throw new AppError('INTERNAL_ERROR', 'Failed to create message', 500);
    }

    await tx
      .update(conversations)
      .set({
        lastMessageAt: now,
        updatedAt: now,
      })
      .where(eq(conversations.id, conversationId));

    return message;
  });

  const dto = await toMessageDto(created);

  broadcastMessageNew({
    conversationId,
    message: dto,
  });

  return dto;
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
  input: MarkConversationReadInput
): Promise<{ conversationId: string; lastReadAt: string }> {
  await assertConversationMember(conversationId, userId);

  const readAt = input.readAt ? new Date(input.readAt) : new Date();
  if (Number.isNaN(readAt.getTime())) {
    throw new AppError('VALIDATION_ERROR', 'Invalid readAt', 400, { field: 'readAt' });
  }

  const [updated] = await db
    .update(conversationMembers)
    .set({ lastReadAt: readAt })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
        isNull(conversationMembers.leftAt)
      )
    )
    .returning();

  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Failed to update read state', 500);
  }

  const result = {
    conversationId,
    lastReadAt: updated.lastReadAt?.toISOString() ?? readAt.toISOString(),
  };

  broadcastMessageRead({
    conversationId,
    userId,
    lastReadAt: result.lastReadAt,
  });

  return result;
}
