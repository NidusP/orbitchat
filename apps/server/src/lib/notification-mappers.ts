import type { InteractionNotification, PostAuthorSummary } from '@orbitchat/shared-types';
import type { Notification as DbNotification } from '../db/schema/notifications';

const PREVIEW_MAX_LENGTH = 80;

export function truncateNotificationPreview(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= PREVIEW_MAX_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, PREVIEW_MAX_LENGTH)}…`;
}

export function toInteractionNotification(
  row: DbNotification,
  actor: PostAuthorSummary,
  postContent: string | null,
  commentContent: string | null,
  messageContent: string | null
): InteractionNotification {
  if (row.type === 'message_received') {
    const notification: InteractionNotification = {
      id: row.id,
      type: 'message_received',
      actor,
      conversationId: row.conversationId ?? undefined,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };

    if (row.messageId && messageContent !== null) {
      notification.message = {
        id: row.messageId,
        contentPreview: truncateNotificationPreview(messageContent),
      };
    }

    return notification;
  }

  const notification: InteractionNotification = {
    id: row.id,
    type: row.type,
    actor,
    post: {
      id: row.postId!,
      contentPreview: truncateNotificationPreview(postContent ?? ''),
    },
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };

  if (row.type === 'post_commented' && row.commentId && commentContent) {
    notification.comment = {
      id: row.commentId,
      contentPreview: truncateNotificationPreview(commentContent),
    };
  }

  return notification;
}
