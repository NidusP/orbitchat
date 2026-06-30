import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { CursorPage, UserSearchResult } from '@orbitchat/shared-types';
import { clampCursorLimit } from '@orbitchat/shared-types';
import { db } from '../db';
import { follows } from '../db/schema/follows';
import { profiles } from '../db/schema/profiles';
import { users } from '../db/schema/users';
import { AppError } from '../lib/errors';
import { decodeTimelineCursor, encodeTimelineCursor, trimToPage } from '../lib/cursor';
import { findUserById } from './user-service';

function decodeUsernameCursor(raw: string): { username: string; id: string } {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const separatorIndex = decoded.indexOf('|');
    if (separatorIndex === -1) {
      throw new Error('invalid');
    }
    return {
      username: decoded.slice(0, separatorIndex),
      id: decoded.slice(separatorIndex + 1),
    };
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Invalid cursor', 400, { field: 'cursor' });
  }
}

function encodeUsernameCursor(username: string, id: string): string {
  return Buffer.from(`${username}|${id}`).toString('base64url');
}

function usernameAfter(cursor: { username: string; id: string } | undefined) {
  if (!cursor) {
    return undefined;
  }
  return sql`(${users.username}, ${users.id}) > (${cursor.username}, ${cursor.id}::uuid)`;
}

function toUserSearchResult(row: {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}): UserSearchResult {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  };
}

async function getUserOrThrow(userId: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }
}

export async function followUser(followerId: string, followeeId: string): Promise<{ following: boolean }> {
  if (followerId === followeeId) {
    throw new AppError('VALIDATION_ERROR', 'You cannot follow yourself', 400, { field: 'id' });
  }

  await getUserOrThrow(followeeId);

  const existing = await db.query.follows.findFirst({
    where: and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)),
  });

  if (existing) {
    return { following: true };
  }

  await db.insert(follows).values({ followerId, followeeId });
  return { following: true };
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<{ following: boolean }> {
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));

  return { following: false };
}

async function listFollowUsers(
  filterColumn: 'followee' | 'follower',
  userId: string,
  params: { cursor?: string; limit?: number }
): Promise<CursorPage<UserSearchResult>> {
  await getUserOrThrow(userId);
  const limit = clampCursorLimit(params.limit);
  const cursor = params.cursor ? decodeTimelineCursor(params.cursor) : undefined;

  const filter =
    filterColumn === 'followee' ? eq(follows.followeeId, userId) : eq(follows.followerId, userId);
  const joinUserColumn =
    filterColumn === 'followee' ? follows.followerId : follows.followeeId;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      createdAt: follows.createdAt,
      followId: follows.id,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, joinUserColumn))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        filter,
        cursor
          ? sql`(${follows.createdAt}, ${follows.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
          : undefined
      )
    )
    .orderBy(desc(follows.createdAt), desc(follows.id))
    .limit(limit + 1);

  const pageRows = trimToPage(rows, limit);
  const items = pageRows.map((row) =>
    toUserSearchResult({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
    })
  );

  const lastRow = rows[limit - 1];
  const nextCursor =
    rows.length > limit && lastRow
      ? encodeTimelineCursor(lastRow.createdAt, lastRow.followId)
      : null;

  return { items, nextCursor };
}

export async function getFollowers(
  userId: string,
  params: { cursor?: string; limit?: number }
): Promise<CursorPage<UserSearchResult>> {
  return listFollowUsers('followee', userId, params);
}

export async function getFollowing(
  userId: string,
  params: { cursor?: string; limit?: number }
): Promise<CursorPage<UserSearchResult>> {
  return listFollowUsers('follower', userId, params);
}

export async function searchUsers(
  query: string,
  params: { cursor?: string; limit?: number }
): Promise<CursorPage<UserSearchResult>> {
  const limit = clampCursorLimit(params.limit);
  const cursor = params.cursor ? decodeUsernameCursor(params.cursor) : undefined;
  const pattern = `%${query}%`;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        eq(users.isActive, true),
        or(ilike(users.username, pattern), ilike(profiles.displayName, pattern)),
        usernameAfter(cursor)
      )
    )
    .orderBy(users.username, users.id)
    .limit(limit + 1);

  const pageRows = trimToPage(rows, limit);
  const items = pageRows.map(toUserSearchResult);
  const lastRow = rows[limit - 1];
  const nextCursor =
    rows.length > limit && lastRow
      ? encodeUsernameCursor(lastRow.username, lastRow.id)
      : null;

  return { items, nextCursor };
}
