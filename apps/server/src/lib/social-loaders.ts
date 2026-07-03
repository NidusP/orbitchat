import { and, eq, inArray } from 'drizzle-orm';
import type { PostAuthorSummary } from '@orbitchat/shared-types';
import { db } from '../db';
import { likes } from '../db/schema/likes';
import { profiles } from '../db/schema/profiles';
import { users } from '../db/schema/users';
import { toPostAuthorSummary } from './social-mappers';

export async function loadAuthorSummaries(userIds: string[]): Promise<Map<string, PostAuthorSummary>> {
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

  const map = new Map<string, PostAuthorSummary>();
  for (const row of rows) {
    map.set(row.userId, toPostAuthorSummary(row));
  }
  return map;
}

export async function loadLikedPostIds(viewerId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) {
    return new Set();
  }

  const rows = await db
    .select({ postId: likes.postId })
    .from(likes)
    .where(and(eq(likes.userId, viewerId), inArray(likes.postId, postIds)));

  return new Set(rows.map((row) => row.postId));
}
