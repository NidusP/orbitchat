import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Conversation, CursorPage } from '@orbitchat/shared-types';
import { clampCursorLimit } from '@orbitchat/shared-types';
import { db } from '../db';
import { conversationMembers } from '../db/schema/conversation-members';
import { conversations } from '../db/schema/conversations';
import { messages } from '../db/schema/messages';
import {
  buildConversationListNextCursor,
  decodeConversationListCursor,
  type ConversationListCursor,
} from '../lib/conversation-cursor';
import {
  loadParticipantsByConversation,
  loadParticipantSummaries,
  loadViewerRole,
  loadViewerRoles,
} from '../lib/conversation-loaders';
import { toConversation, toMessage } from '../lib/conversation-mappers';
import { buildDirectKey } from '../lib/direct-key';
import { trimToPage } from '../lib/cursor';
import { AppError } from '../lib/errors';
import type { CreateDirectConversationInput, CreateGroupConversationInput } from '../schemas/conversations';
import { findUserById } from './user-service';

function conversationListBefore(cursor: ConversationListCursor | undefined) {
  if (!cursor) {
    return undefined;
  }

  return sql`(COALESCE(${conversations.lastMessageAt}, ${conversations.updatedAt}), ${conversations.id}) < (${cursor.sortAt}::timestamptz, ${cursor.id}::uuid)`;
}

async function loadUnreadCounts(
  userId: string,
  memberships: Array<{ conversationId: string; lastReadAt: Date | null }>
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (memberships.length === 0) {
    return map;
  }

  for (const membership of memberships) {
    const conditions = [
      eq(messages.conversationId, membership.conversationId),
      sql`${messages.senderId} <> ${userId}::uuid`,
      isNull(messages.deletedAt),
    ];

    if (membership.lastReadAt) {
      conditions.push(gt(messages.createdAt, membership.lastReadAt));
    }

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(...conditions));

    map.set(membership.conversationId, row?.count ?? 0);
  }

  return map;
}

async function loadLastMessages(
  conversationIds: string[]
): Promise<Map<string, (typeof messages.$inferSelect)>> {
  const map = new Map<string, (typeof messages.$inferSelect)>();
  if (conversationIds.length === 0) {
    return map;
  }

  await Promise.all(
    conversationIds.map(async (conversationId) => {
      const [row] = await db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1);

      if (row) {
        map.set(conversationId, row);
      }
    })
  );

  return map;
}

export async function assertConversationMember(
  conversationId: string,
  userId: string
): Promise<typeof conversationMembers.$inferSelect> {
  const member = await db.query.conversationMembers.findFirst({
    where: and(
      eq(conversationMembers.conversationId, conversationId),
      eq(conversationMembers.userId, userId),
      isNull(conversationMembers.leftAt)
    ),
  });

  if (!member) {
    throw new AppError('FORBIDDEN', 'You are not a member of this conversation', 403);
  }

  return member;
}

export async function createOrGetDirectConversation(
  actorUserId: string,
  input: CreateDirectConversationInput
): Promise<{ conversation: Conversation; created: boolean }> {
  const { participantUserId } = input;

  if (participantUserId === actorUserId) {
    throw new AppError('VALIDATION_ERROR', 'You cannot start a conversation with yourself', 400, {
      field: 'participantUserId',
    });
  }

  await findUserById(participantUserId);

  const directKey = buildDirectKey(actorUserId, participantUserId);

  const existing = await db.query.conversations.findFirst({
    where: eq(conversations.directKey, directKey),
  });

  if (existing) {
    await assertConversationMember(existing.id, actorUserId);
    const conversation = await getConversationDto(existing.id, actorUserId);
    return { conversation, created: false };
  }

  const created = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .insert(conversations)
      .values({
        type: 'direct',
        directKey,
      })
      .returning();

    if (!conversation) {
      throw new AppError('INTERNAL_ERROR', 'Failed to create conversation', 500);
    }

    await tx.insert(conversationMembers).values([
      { conversationId: conversation.id, userId: actorUserId },
      { conversationId: conversation.id, userId: participantUserId },
    ]);

    return conversation;
  });

  const conversation = await getConversationDto(created.id, actorUserId);
  return { conversation, created: true };
}

export async function createGroupConversation(
  actorUserId: string,
  input: CreateGroupConversationInput
): Promise<{ conversation: Conversation; created: boolean }> {
  const uniqueMemberIds = [...new Set(input.memberUserIds.filter((id) => id !== actorUserId))];

  if (uniqueMemberIds.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'A group needs at least one other member', 400, {
      field: 'memberUserIds',
    });
  }

  await Promise.all(uniqueMemberIds.map((userId) => findUserById(userId)));

  const created = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .insert(conversations)
      .values({
        type: 'group',
        title: input.title,
        createdByUserId: actorUserId,
      })
      .returning();

    if (!conversation) {
      throw new AppError('INTERNAL_ERROR', 'Failed to create group conversation', 500);
    }

    await tx.insert(conversationMembers).values([
      { conversationId: conversation.id, userId: actorUserId, role: 'owner' },
      ...uniqueMemberIds.map((userId) => ({
        conversationId: conversation.id,
        userId,
        role: 'member' as const,
      })),
    ]);

    return conversation;
  });

  const conversation = await getConversationDto(created.id, actorUserId);
  return { conversation, created: true };
}

export async function getConversationDto(
  conversationId: string,
  viewerId: string
): Promise<Conversation> {
  const membership = await assertConversationMember(conversationId, viewerId);

  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
  });

  if (!conversation) {
    throw new AppError('NOT_FOUND', 'Conversation not found', 404);
  }

  const participantsMap = await loadParticipantsByConversation([conversationId]);
  const participants = participantsMap.get(conversationId) ?? [];

  const lastMessages = await loadLastMessages([conversationId]);
  const lastRow = lastMessages.get(conversationId);
  let lastMessage = null;

  if (lastRow) {
    const senders = await loadParticipantSummaries([lastRow.senderId]);
    const sender = senders.get(lastRow.senderId);
    if (sender) {
      lastMessage = toMessage(lastRow, sender);
    }
  }

  const unreadMap = await loadUnreadCounts(viewerId, [
    { conversationId, lastReadAt: membership.lastReadAt },
  ]);

  return toConversation(
    conversation,
    participants,
    lastMessage,
    unreadMap.get(conversationId) ?? 0,
    conversation.type === 'group' ? await loadViewerRole(conversationId, viewerId) : null
  );
}

export async function listConversations(
  userId: string,
  params: { cursor?: string; limit?: number }
): Promise<CursorPage<Conversation>> {
  const limit = clampCursorLimit(params.limit);
  const cursor = params.cursor ? decodeConversationListCursor(params.cursor) : undefined;

  const rows = await db
    .select({
      conversation: conversations,
      membership: conversationMembers,
      sortAt: sql<Date>`COALESCE(${conversations.lastMessageAt}, ${conversations.updatedAt})`.as(
        'sort_at'
      ),
    })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(
      and(
        eq(conversationMembers.userId, userId),
        isNull(conversationMembers.leftAt),
        conversationListBefore(cursor)
      )
    )
    .orderBy(
      desc(sql`COALESCE(${conversations.lastMessageAt}, ${conversations.updatedAt})`),
      desc(conversations.id)
    )
    .limit(limit + 1);

  const pageRows = trimToPage(rows, limit);
  const conversationIds = pageRows.map((row) => row.conversation.id);

  const [participantsMap, lastMessagesMap, unreadMap, viewerRolesMap] = await Promise.all([
    loadParticipantsByConversation(conversationIds),
    loadLastMessages(conversationIds),
    loadUnreadCounts(
      userId,
      pageRows.map((row) => ({
        conversationId: row.conversation.id,
        lastReadAt: row.membership.lastReadAt,
      }))
    ),
    loadViewerRoles(
      pageRows.filter((row) => row.conversation.type === 'group').map((row) => row.conversation.id),
      userId
    ),
  ]);

  const senderIds = [...lastMessagesMap.values()].map((message) => message.senderId);
  const senders = await loadParticipantSummaries(senderIds);

  const items = pageRows.map((row) => {
    const participants = participantsMap.get(row.conversation.id) ?? [];
    const lastRow = lastMessagesMap.get(row.conversation.id);
    let lastMessage = null;

    if (lastRow) {
      const sender = senders.get(lastRow.senderId);
      if (sender) {
        lastMessage = toMessage(lastRow, sender);
      }
    }

    return toConversation(
      row.conversation,
      participants,
      lastMessage,
      unreadMap.get(row.conversation.id) ?? 0,
      row.conversation.type === 'group'
        ? (viewerRolesMap.get(row.conversation.id) ?? null)
        : null
    );
  });

  const nextCursor = buildConversationListNextCursor(
    pageRows.map((row) => ({
      sortAt: row.sortAt,
      id: row.conversation.id,
    })),
    limit
  );

  return { items, nextCursor };
}

export async function listConversationIdsForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.userId, userId), isNull(conversationMembers.leftAt)));

  return rows.map((row) => row.conversationId);
}
