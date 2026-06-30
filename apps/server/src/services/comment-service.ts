import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { CommentWithAuthor, CursorPage } from '@orbitchat/shared-types';
import { clampCursorLimit } from '@orbitchat/shared-types';
import { db } from '../db';
import { comments } from '../db/schema/comments';
import { posts } from '../db/schema/posts';
import { AppError } from '../lib/errors';
import {
  buildNextCursor,
  decodeTimelineCursor,
  trimToPage,
  type TimelineCursor,
} from '../lib/cursor';
import { loadAuthorSummaries } from '../lib/social-loaders';
import { toCommentWithAuthor } from '../lib/social-mappers';
import type { CreateCommentInput } from '../schemas/posts';

function timelineBefore(cursor: TimelineCursor | undefined) {
  if (!cursor) {
    return undefined;
  }

  return sql`(${comments.createdAt}, ${comments.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
}

async function getActiveComment(commentId: string) {
  const comment = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), isNull(comments.deletedAt)),
  });

  if (!comment) {
    throw new AppError('NOT_FOUND', 'Comment not found', 404);
  }

  return comment;
}

async function assertActivePost(postId: string): Promise<typeof posts.$inferSelect> {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), isNull(posts.deletedAt)),
  });

  if (!post) {
    throw new AppError('NOT_FOUND', 'Post not found', 404);
  }

  return post;
}

export async function listPostComments(
  postId: string,
  params: { cursor?: string; limit?: number }
): Promise<CursorPage<CommentWithAuthor>> {
  await assertActivePost(postId);

  const limit = clampCursorLimit(params.limit);
  const cursor = params.cursor ? decodeTimelineCursor(params.cursor) : undefined;

  // comments_post_timeline_idx: WHERE post_id = ? ORDER BY created_at
  const rows = await db
    .select()
    .from(comments)
    .where(and(eq(comments.postId, postId), isNull(comments.deletedAt), timelineBefore(cursor)))
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .limit(limit + 1);

  const pageRows = trimToPage(rows, limit);
  const authors = await loadAuthorSummaries(pageRows.map((row) => row.authorId));
  const items = pageRows.map((row) => {
    const author = authors.get(row.authorId);
    if (!author) {
      throw new AppError('NOT_FOUND', 'Comment author not found', 404);
    }
    return toCommentWithAuthor(row, author);
  });

  return { items, nextCursor: buildNextCursor(rows, limit) };
}

export async function createComment(
  postId: string,
  authorId: string,
  input: CreateCommentInput
): Promise<CommentWithAuthor> {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), isNull(posts.deletedAt)),
  });

  if (!post) {
    throw new AppError('NOT_FOUND', 'Post not found', 404);
  }

  const [created] = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(comments)
      .values({
        postId,
        authorId,
        content: input.content,
      })
      .returning();

    await tx
      .update(posts)
      .set({ commentCount: post.commentCount + 1 })
      .where(eq(posts.id, postId));

    return inserted;
  });

  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create comment', 500);
  }

  const authors = await loadAuthorSummaries([authorId]);
  const author = authors.get(authorId);
  if (!author) {
    throw new AppError('NOT_FOUND', 'Author not found', 404);
  }

  return toCommentWithAuthor(created, author);
}

export async function deleteComment(commentId: string, actorId: string): Promise<void> {
  const comment = await getActiveComment(commentId);
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, comment.postId),
  });

  if (!post) {
    throw new AppError('NOT_FOUND', 'Post not found', 404);
  }

  const canDelete = comment.authorId === actorId || post.authorId === actorId;
  if (!canDelete) {
    throw new AppError('FORBIDDEN', 'You can only delete your own comments or comments on your posts', 403);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(comments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(comments.id, commentId));

    await tx
      .update(posts)
      .set({ commentCount: Math.max(0, post.commentCount - 1) })
      .where(eq(posts.id, post.id));
  });
}
