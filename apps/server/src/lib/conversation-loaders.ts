import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { ConversationParticipant, GroupMember, GroupMemberRole, PostMediaItem } from '@orbitchat/shared-types';
import { db } from '../db';
import { conversationMembers } from '../db/schema/conversation-members';
import { messageMedia } from '../db/schema/message-media';
import { profiles } from '../db/schema/profiles';
import { uploads } from '../db/schema/uploads';
import { users } from '../db/schema/users';
import { resolveMediaUrl } from '../services/upload-service';
import { toConversationParticipant, toGroupMember } from './conversation-mappers';

export async function loadParticipantSummaries(
  userIds: string[]
): Promise<Map<string, ConversationParticipant>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const uniqueIds = [...new Set(userIds)];
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(inArray(users.id, uniqueIds));

  const map = new Map<string, ConversationParticipant>();
  for (const row of rows) {
    map.set(row.userId, toConversationParticipant(row));
  }
  return map;
}

export async function loadMessageMediaByMessageIds(
  messageIds: string[]
): Promise<Map<string, PostMediaItem[]>> {
  const result = new Map<string, PostMediaItem[]>();
  if (messageIds.length === 0) {
    return result;
  }

  const rows = await db
    .select({
      messageId: messageMedia.messageId,
      id: messageMedia.id,
      uploadId: messageMedia.uploadId,
      sortOrder: messageMedia.sortOrder,
      mimeType: uploads.mimeType,
      sizeBytes: uploads.sizeBytes,
    })
    .from(messageMedia)
    .innerJoin(uploads, eq(uploads.id, messageMedia.uploadId))
    .where(inArray(messageMedia.messageId, messageIds))
    .orderBy(messageMedia.sortOrder);

  for (const row of rows) {
    const items = result.get(row.messageId) ?? [];
    items.push({
      id: row.id,
      uploadId: row.uploadId,
      url: resolveMediaUrl(row.uploadId),
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      sortOrder: row.sortOrder,
    });
    result.set(row.messageId, items);
  }

  return result;
}

export async function loadParticipantsByConversation(
  conversationIds: string[]
): Promise<Map<string, ConversationParticipant[]>> {
  if (conversationIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      conversationId: conversationMembers.conversationId,
      userId: users.id,
      username: users.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        inArray(conversationMembers.conversationId, conversationIds),
        isNull(conversationMembers.leftAt)
      )
    );

  const map = new Map<string, ConversationParticipant[]>();
  for (const row of rows) {
    const list = map.get(row.conversationId) ?? [];
    list.push(toConversationParticipant(row));
    map.set(row.conversationId, list);
  }
  return map;
}

export async function loadGroupMembers(conversationId: string): Promise<GroupMember[]> {
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      role: conversationMembers.role,
      joinedAt: conversationMembers.joinedAt,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.leftAt))
    );

  return rows
    .filter((row): row is typeof row & { role: GroupMemberRole } => row.role !== null)
    .map((row) => toGroupMember(row));
}

export async function loadViewerRole(
  conversationId: string,
  userId: string
): Promise<GroupMemberRole | null> {
  const member = await db.query.conversationMembers.findFirst({
    where: and(
      eq(conversationMembers.conversationId, conversationId),
      eq(conversationMembers.userId, userId),
      isNull(conversationMembers.leftAt)
    ),
  });

  return member?.role ?? null;
}

export async function loadViewerRoles(
  conversationIds: string[],
  userId: string
): Promise<Map<string, GroupMemberRole>> {
  const map = new Map<string, GroupMemberRole>();
  if (conversationIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({
      conversationId: conversationMembers.conversationId,
      role: conversationMembers.role,
    })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.userId, userId),
        inArray(conversationMembers.conversationId, conversationIds),
        isNull(conversationMembers.leftAt)
      )
    );

  for (const row of rows) {
    if (row.role) {
      map.set(row.conversationId, row.role);
    }
  }

  return map;
}
