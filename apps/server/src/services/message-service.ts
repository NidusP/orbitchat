import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { Message, MessageEditRecord, MessageListResponse, MessageRecall } from '@orbitchat/shared-types';
import { db } from '../db';
import { conversationMembers } from '../db/schema/conversation-members';
import { conversations } from '../db/schema/conversations';
import { messageEdits } from '../db/schema/message-edits';
import { messageRecalls } from '../db/schema/message-recalls';
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
import { MESSAGE_EDIT_WINDOW_MS, MESSAGE_RECALL_WINDOW_MS } from '../lib/message-policy';
import {
  broadcastMessageNew,
  broadcastMessageRead,
  broadcastMessageRecalled,
} from '../realtime/chat-hub';
import type {
  CreateMessageInput,
  MarkConversationReadInput,
  MessageCursorQueryInput,
  UpdateMessageInput,
} from '../schemas/conversations';
import { clampMessageLimit } from '../schemas/conversations';
import { assertConversationMember } from './conversation-service';

function messageTimelineBefore(cursor: TimelineCursor | undefined) {
  if (!cursor) {
    return undefined;
  }

  return sql`(${messages.createdAt}, ${messages.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
}

function assertWithinActionWindow(createdAt: Date, windowMs: number, action: 'recall' | 'edit'): void {
  if (Date.now() - createdAt.getTime() > windowMs) {
    throw new AppError(
      'VALIDATION_ERROR',
      action === 'recall'
        ? 'Message can only be recalled within 3 minutes'
        : 'Message can only be edited within 15 minutes',
      400
    );
  }
}

async function toMessageDto(row: typeof messages.$inferSelect): Promise<Message> {
  const senders = await loadParticipantSummaries([row.senderId]);
  const sender = senders.get(row.senderId);
  if (!sender) {
    throw new AppError('NOT_FOUND', 'Sender not found', 404);
  }
  return toMessage(row, sender);
}

async function toRecallDto(row: typeof messageRecalls.$inferSelect): Promise<MessageRecall> {
  const actors = await loadParticipantSummaries([row.recalledByUserId]);
  const recalledBy = actors.get(row.recalledByUserId);
  if (!recalledBy) {
    throw new AppError('NOT_FOUND', 'Recaller not found', 404);
  }

  return {
    id: row.id,
    conversationId: row.conversationId,
    messageId: row.messageId,
    recalledBy,
    messageCreatedAt: row.messageCreatedAt.toISOString(),
    recalledAt: row.recalledAt.toISOString(),
  };
}

async function refreshConversationLastMessage(
  tx: Pick<typeof db, 'select' | 'update'>,
  conversationId: string
): Promise<void> {
  const [lastMessage] = await tx
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(1);

  await tx
    .update(conversations)
    .set({
      lastMessageAt: lastMessage?.createdAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId));
}

async function loadRecallsForMessageWindow(
  conversationId: string,
  pageRows: Array<typeof messages.$inferSelect>
): Promise<MessageRecall[]> {
  if (pageRows.length === 0) {
    return [];
  }

  const oldest = pageRows[pageRows.length - 1];
  const newest = pageRows[0];
  if (!oldest || !newest) {
    return [];
  }

  const recallRows = await db
    .select()
    .from(messageRecalls)
    .where(
      and(
        eq(messageRecalls.conversationId, conversationId),
        gte(messageRecalls.messageCreatedAt, oldest.createdAt),
        lte(messageRecalls.messageCreatedAt, newest.createdAt)
      )
    )
    .orderBy(messageRecalls.messageCreatedAt, messageRecalls.id);

  return Promise.all(recallRows.map((row) => toRecallDto(row)));
}

export async function listMessages(
  conversationId: string,
  viewerId: string,
  params: MessageCursorQueryInput
): Promise<MessageListResponse> {
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

  const recalls = await loadRecallsForMessageWindow(conversationId, pageRows);
  const nextCursor = buildNextCursor(rows, limit);
  return { items, recalls, nextCursor };
}

export async function listMessageEdits(
  conversationId: string,
  messageId: string,
  viewerId: string
): Promise<MessageEditRecord[]> {
  await assertConversationMember(conversationId, viewerId);

  const message = await db.query.messages.findFirst({
    where: and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)),
  });
  if (!message || message.deletedAt) {
    throw new AppError('NOT_FOUND', 'Message not found', 404);
  }

  const rows = await db.query.messageEdits.findMany({
    where: eq(messageEdits.messageId, messageId),
    orderBy: (table, { desc: descOrder }) => [descOrder(table.editedAt)],
  });

  const editorIds = rows.map((row) => row.editorUserId);
  const editors = await loadParticipantSummaries(editorIds);

  return rows.map((row) => {
    const editor = editors.get(row.editorUserId);
    if (!editor) {
      throw new AppError('NOT_FOUND', 'Editor not found', 404);
    }
    return {
      id: row.id,
      messageId: row.messageId,
      editor,
      previousContent: row.previousContent,
      editedAt: row.editedAt.toISOString(),
    };
  });
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

export async function updateMessage(
  conversationId: string,
  messageId: string,
  actorUserId: string,
  input: UpdateMessageInput
): Promise<Message> {
  await assertConversationMember(conversationId, actorUserId);

  const message = await db.query.messages.findFirst({
    where: and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)),
  });
  if (!message) {
    throw new AppError('NOT_FOUND', 'Message not found', 404);
  }
  if (message.deletedAt) {
    throw new AppError('VALIDATION_ERROR', 'Recalled messages cannot be edited', 400);
  }
  if (message.senderId !== actorUserId) {
    throw new AppError('FORBIDDEN', 'Only message sender can edit message', 403);
  }
  assertWithinActionWindow(message.createdAt, MESSAGE_EDIT_WINDOW_MS, 'edit');

  if (message.content === input.content) {
    throw new AppError('VALIDATION_ERROR', 'Message content is unchanged', 400, {
      field: 'content',
    });
  }

  const updated = await db.transaction(async (tx) => {
    await tx.insert(messageEdits).values({
      messageId: message.id,
      editorUserId: actorUserId,
      previousContent: message.content,
    });

    return tx
      .update(messages)
      .set({
        content: input.content,
        editedAt: new Date(),
      })
      .where(eq(messages.id, message.id))
      .returning();
  });

  const row = updated[0];
  if (!row) {
    throw new AppError('INTERNAL_ERROR', 'Failed to update message', 500);
  }
  return toMessageDto(row);
}

export async function deleteMessage(
  conversationId: string,
  messageId: string,
  actorUserId: string
): Promise<{ ok: true }> {
  await assertConversationMember(conversationId, actorUserId);

  const message = await db.query.messages.findFirst({
    where: and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)),
  });
  if (!message) {
    throw new AppError('NOT_FOUND', 'Message not found', 404);
  }
  if (message.deletedAt) {
    throw new AppError('VALIDATION_ERROR', 'Message has already been recalled', 400);
  }
  if (message.senderId !== actorUserId) {
    throw new AppError('FORBIDDEN', 'Only message sender can recall message', 403);
  }
  assertWithinActionWindow(message.createdAt, MESSAGE_RECALL_WINDOW_MS, 'recall');

  const recalledAt = new Date();
  const recallRow = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(messages)
      .set({ deletedAt: recalledAt })
      .where(and(eq(messages.id, message.id), isNull(messages.deletedAt)))
      .returning();

    if (!updated) {
      throw new AppError('VALIDATION_ERROR', 'Message has already been recalled', 400);
    }

    const [createdRecall] = await tx
      .insert(messageRecalls)
      .values({
        conversationId,
        messageId: message.id,
        recalledByUserId: actorUserId,
        messageCreatedAt: message.createdAt,
        recalledAt,
      })
      .returning();

    if (!createdRecall) {
      throw new AppError('INTERNAL_ERROR', 'Failed to record message recall', 500);
    }

    await refreshConversationLastMessage(tx, conversationId);
    return createdRecall;
  });

  const recall = await toRecallDto(recallRow);
  broadcastMessageRecalled({ conversationId, recall });

  return { ok: true };
}
