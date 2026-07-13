import { and, eq, inArray } from 'drizzle-orm';
import type { PostAuthorSummary, PostMediaItem } from '@orbitchat/shared-types';
import { db } from '../db';
import { likes } from '../db/schema/likes';
import { postMedia } from '../db/schema/post-media';
import { profiles } from '../db/schema/profiles';
import { uploads } from '../db/schema/uploads';
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

export async function loadPostMediaByPostIds(postIds: string[]): Promise<Map<string, PostMediaItem[]>> {
  const result = new Map<string, PostMediaItem[]>();
  if (postIds.length === 0) {
    return result;
  }

  const rows = await db
    .select({
      postId: postMedia.postId,
      id: postMedia.id,
      uploadId: postMedia.uploadId,
      sortOrder: postMedia.sortOrder,
      mimeType: uploads.mimeType,
      sizeBytes: uploads.sizeBytes,
    })
    .from(postMedia)
    .innerJoin(uploads, eq(uploads.id, postMedia.uploadId))
    .where(inArray(postMedia.postId, postIds))
    .orderBy(postMedia.sortOrder);

  for (const row of rows) {
    const items = result.get(row.postId) ?? [];
    items.push({
      id: row.id,
      uploadId: row.uploadId,
      url: `/api/v1/media/${row.uploadId}`,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      sortOrder: row.sortOrder,
    });
    result.set(row.postId, items);
  }

  for (const postId of postIds) {
    if (!result.has(postId)) {
      result.set(postId, []);
    }
  }

  return result;
}
