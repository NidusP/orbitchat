import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { ConversationParticipant, GroupMember, GroupMemberRole } from '@orbitchat/shared-types';
import { db } from '../db';
import { conversationMembers } from '../db/schema/conversation-members';
import { profiles } from '../db/schema/profiles';
import { users } from '../db/schema/users';
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
