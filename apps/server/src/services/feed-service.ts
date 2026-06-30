import { and, desc, eq, exists, isNull, or, sql } from 'drizzle-orm';
import type { CursorPage, PostWithAuthor } from '@orbitchat/shared-types';
import { clampCursorLimit } from '@orbitchat/shared-types';
import { db } from '../db';
import { follows } from '../db/schema/follows';
import { posts } from '../db/schema/posts';
import {
  buildNextCursor,
  decodeTimelineCursor,
  trimToPage,
  type TimelineCursor,
} from '../lib/cursor';
import { loadAuthorSummaries, loadLikedPostIds } from '../lib/social-loaders';
import { toPostWithAuthor } from '../lib/social-mappers';

function timelineBefore(cursor: TimelineCursor | undefined) {
  if (!cursor) {
    return undefined;
  }

  // SQL tuple compare: (created_at, id) < (cursor) — uses posts_author_timeline_idx on profile feeds
  return sql`(${posts.createdAt}, ${posts.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
}

async function enrichPosts(viewerId: string, rows: typeof posts.$inferSelect[]): Promise<PostWithAuthor[]> {
  const authorIds = rows.map((row) => row.authorId);
  const postIds = rows.map((row) => row.id);
  const [authors, likedIds] = await Promise.all([
    loadAuthorSummaries(authorIds),
    loadLikedPostIds(viewerId, postIds),
  ]);

  return rows.map((row) => {
    const author = authors.get(row.authorId);
    if (!author) {
      throw new Error(`Author not found for post ${row.id}`);
    }
    return toPostWithAuthor(row, author, likedIds.has(row.id));
  });
}

export async function getHomeFeed(
  viewerId: string,
  params: { cursor?: string; limit?: number }
): Promise<CursorPage<PostWithAuthor>> {
  const limit = clampCursorLimit(params.limit);
  const cursor = params.cursor ? decodeTimelineCursor(params.cursor) : undefined;

  // Fan-out on read: posts from followed users OR self (ADR 11).
  // follows_follower_id_idx → Map.get(follower_id) instead of scanning all follows.
  const followExists = exists(
    db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, posts.authorId)))
  );

  const rows = await db
    .select()
    .from(posts)
    .where(
      and(
        isNull(posts.deletedAt),
        or(eq(posts.authorId, viewerId), followExists),
        timelineBefore(cursor)
      )
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit + 1);

  const pageRows = trimToPage(rows, limit);
  const items = await enrichPosts(viewerId, pageRows);
  const nextCursor = buildNextCursor(rows, limit);

  return { items, nextCursor };
}

export async function getUserPosts(
  targetUserId: string,
  viewerId: string | null,
  params: { cursor?: string; limit?: number }
): Promise<CursorPage<PostWithAuthor>> {
  const limit = clampCursorLimit(params.limit);
  const cursor = params.cursor ? decodeTimelineCursor(params.cursor) : undefined;

  // posts_author_timeline_idx matches author_id + created_at filter
  const rows = await db
    .select()
    .from(posts)
    .where(
      and(eq(posts.authorId, targetUserId), isNull(posts.deletedAt), timelineBefore(cursor))
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit + 1);

  const pageRows = trimToPage(rows, limit);
  const items = await enrichPosts(viewerId ?? targetUserId, pageRows);
  const nextCursor = buildNextCursor(rows, limit);

  return { items, nextCursor };
}
