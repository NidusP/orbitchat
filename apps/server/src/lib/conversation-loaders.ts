import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { ConversationParticipant } from '@orbitchat/shared-types';
import { db } from '../db';
import { conversationMembers } from '../db/schema/conversation-members';
import { profiles } from '../db/schema/profiles';
import { users } from '../db/schema/users';
import { toConversationParticipant } from './conversation-mappers';

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
