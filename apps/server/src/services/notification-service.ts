import { and, count, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import type { CursorPage, InteractionNotification } from '@orbitchat/shared-types';
import { clampCursorLimit } from '@orbitchat/shared-types';
import { db } from '../db';
import { comments } from '../db/schema/comments';
import { messages } from '../db/schema/messages';
import { notifications } from '../db/schema/notifications';
import { posts } from '../db/schema/posts';
import {
  buildNextCursor,
  decodeTimelineCursor,
  trimToPage,
  type TimelineCursor,
} from '../lib/cursor';
import { toInteractionNotification } from '../lib/notification-mappers';
import { loadAuthorSummaries } from '../lib/social-loaders';
import type { MarkNotificationsReadInput } from '../schemas/notifications';

function timelineBefore(cursor: TimelineCursor | undefined) {
  if (!cursor) {
    return undefined;
  }

  return sql`(${notifications.createdAt}, ${notifications.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`;
}

function visibleNotificationFilter() {
  return or(
    and(eq(notifications.type, 'post_liked'), isNotNull(notifications.postId), isNotNull(posts.id)),
    and(
      eq(notifications.type, 'post_commented'),
      isNotNull(notifications.postId),
      isNotNull(posts.id),
      isNull(comments.deletedAt)
    ),
    and(
      eq(notifications.type, 'message_received'),
      isNotNull(notifications.conversationId),
      isNotNull(notifications.messageId),
      isNotNull(messages.id),
      isNull(messages.deletedAt)
    )
  );
}

export async function createPostLikedNotification(
  postId: string,
  actorId: string,
  recipientId: string
): Promise<void> {
  if (actorId === recipientId) {
    return;
  }

  await db.insert(notifications).values({
    recipientId,
    actorId,
    type: 'post_liked',
    postId,
  });
}

export async function createPostCommentedNotification(
  postId: string,
  commentId: string,
  actorId: string,
  recipientId: string
): Promise<void> {
  if (actorId === recipientId) {
    return;
  }

  await db.insert(notifications).values({
    recipientId,
    actorId,
    type: 'post_commented',
    postId,
    commentId,
  });
}

export async function createMessageReceivedNotification(
  conversationId: string,
  messageId: string,
  actorId: string,
  recipientId: string
): Promise<void> {
  if (actorId === recipientId) {
    return;
  }

  await db.insert(notifications).values({
    recipientId,
    actorId,
    type: 'message_received',
    conversationId,
    messageId,
  });
}

export async function listNotifications(
  recipientId: string,
  params: { cursor?: string; limit?: number }
): Promise<CursorPage<InteractionNotification>> {
  const limit = clampCursorLimit(params.limit);
  const cursor = params.cursor ? decodeTimelineCursor(params.cursor) : undefined;

  const rows = await db
    .select({
      notification: notifications,
      postContent: posts.content,
      commentContent: comments.content,
      messageContent: messages.content,
    })
    .from(notifications)
    .leftJoin(posts, and(eq(notifications.postId, posts.id), isNull(posts.deletedAt)))
    .leftJoin(comments, eq(notifications.commentId, comments.id))
    .leftJoin(messages, and(eq(notifications.messageId, messages.id), isNull(messages.deletedAt)))
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        timelineBefore(cursor),
        visibleNotificationFilter()
      )
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);

  const pageRows = trimToPage(rows, limit);
  const actorIds = pageRows.map((row) => row.notification.actorId);
  const authors = await loadAuthorSummaries(actorIds);

  const items = pageRows.map((row) => {
    const actor = authors.get(row.notification.actorId);
    if (!actor) {
      throw new Error(`Notification actor not found: ${row.notification.actorId}`);
    }

    return toInteractionNotification(
      row.notification,
      actor,
      row.postContent,
      row.commentContent,
      row.messageContent
    );
  });

  return {
    items,
    nextCursor: buildNextCursor(
      rows.map((row) => row.notification),
      limit
    ),
  };
}

export async function getUnreadNotificationCount(recipientId: string): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(notifications)
    .leftJoin(posts, and(eq(notifications.postId, posts.id), isNull(posts.deletedAt)))
    .leftJoin(comments, eq(notifications.commentId, comments.id))
    .leftJoin(messages, and(eq(notifications.messageId, messages.id), isNull(messages.deletedAt)))
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        isNull(notifications.readAt),
        visibleNotificationFilter()
      )
    );

  return Number(result?.value ?? 0);
}

export async function markNotificationsRead(
  recipientId: string,
  input: MarkNotificationsReadInput
): Promise<number> {
  const now = new Date();
  const whereClause =
    input.notificationIds && input.notificationIds.length > 0
      ? and(
          eq(notifications.recipientId, recipientId),
          inArray(notifications.id, input.notificationIds),
          isNull(notifications.readAt)
        )
      : and(eq(notifications.recipientId, recipientId), isNull(notifications.readAt));

  const updated = await db
    .update(notifications)
    .set({ readAt: now })
    .where(whereClause)
    .returning({ id: notifications.id });

  return updated.length;
}
