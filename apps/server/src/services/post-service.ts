import { and, eq, isNull } from 'drizzle-orm';
import type { PostWithAuthor } from '@orbitchat/shared-types';
import { db } from '../db';
import { likes } from '../db/schema/likes';
import { posts } from '../db/schema/posts';
import { AppError } from '../lib/errors';
import { loadAuthorSummaries, loadLikedPostIds } from '../lib/social-loaders';
import { toPostWithAuthor } from '../lib/social-mappers';
import type { CreatePostInput, UpdatePostInput } from '../schemas/posts';

async function getActivePost(postId: string) {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), isNull(posts.deletedAt)),
  });

  if (!post) {
    throw new AppError('NOT_FOUND', 'Post not found', 404);
  }

  return post;
}

async function toPostDto(post: typeof posts.$inferSelect, viewerId: string | null): Promise<PostWithAuthor> {
  const authors = await loadAuthorSummaries([post.authorId]);
  const author = authors.get(post.authorId);
  if (!author) {
    throw new AppError('NOT_FOUND', 'Author not found', 404);
  }

  const likedIds =
    viewerId !== null ? await loadLikedPostIds(viewerId, [post.id]) : new Set<string>();

  return toPostWithAuthor(post, author, viewerId !== null && likedIds.has(post.id));
}

export async function createPost(authorId: string, input: CreatePostInput): Promise<PostWithAuthor> {
  const [created] = await db
    .insert(posts)
    .values({
      authorId,
      content: input.content,
    })
    .returning();

  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create post', 500);
  }

  return toPostDto(created, authorId);
}

export async function getPostById(postId: string, viewerId: string | null): Promise<PostWithAuthor> {
  const post = await getActivePost(postId);
  return toPostDto(post, viewerId);
}

export async function updatePost(
  postId: string,
  actorId: string,
  input: UpdatePostInput
): Promise<PostWithAuthor> {
  const post = await getActivePost(postId);

  if (post.authorId !== actorId) {
    throw new AppError('FORBIDDEN', 'You can only edit your own posts', 403);
  }

  const [updated] = await db
    .update(posts)
    .set({
      content: input.content,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId))
    .returning();

  if (!updated) {
    throw new AppError('INTERNAL_ERROR', 'Failed to update post', 500);
  }

  return toPostDto(updated, actorId);
}

export async function deletePost(postId: string, actorId: string): Promise<void> {
  const post = await getActivePost(postId);

  if (post.authorId !== actorId) {
    throw new AppError('FORBIDDEN', 'You can only delete your own posts', 403);
  }

  await db
    .update(posts)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(posts.id, postId));
}

export async function likePost(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
  const post = await getActivePost(postId);

  const existing = await db.query.likes.findFirst({
    where: and(eq(likes.userId, userId), eq(likes.postId, postId)),
  });

  if (existing) {
    return { liked: true, likeCount: post.likeCount };
  }

  await db.transaction(async (tx) => {
    await tx.insert(likes).values({ userId, postId });
    await tx
      .update(posts)
      .set({ likeCount: post.likeCount + 1 })
      .where(eq(posts.id, postId));
  });

  return { liked: true, likeCount: post.likeCount + 1 };
}

export async function unlikePost(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
  const post = await getActivePost(postId);

  const existing = await db.query.likes.findFirst({
    where: and(eq(likes.userId, userId), eq(likes.postId, postId)),
  });

  if (!existing) {
    return { liked: false, likeCount: post.likeCount };
  }

  const nextCount = Math.max(0, post.likeCount - 1);

  await db.transaction(async (tx) => {
    await tx.delete(likes).where(and(eq(likes.userId, userId), eq(likes.postId, postId)));
    await tx.update(posts).set({ likeCount: nextCount }).where(eq(posts.id, postId));
  });

  return { liked: false, likeCount: nextCount };
}
