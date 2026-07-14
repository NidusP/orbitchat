import type { PostAuthorSummary } from './post';

export type InteractionNotificationType =
  | 'post_liked'
  | 'post_commented'
  | 'message_received';

export interface InteractionNotificationPostPreview {
  id: string;
  contentPreview: string;
}

export interface InteractionNotificationCommentPreview {
  id: string;
  contentPreview: string;
}

export interface InteractionNotificationMessagePreview {
  id: string;
  contentPreview: string;
}

export interface InteractionNotification {
  id: string;
  type: InteractionNotificationType;
  actor: PostAuthorSummary;
  post?: InteractionNotificationPostPreview;
  comment?: InteractionNotificationCommentPreview;
  conversationId?: string;
  message?: InteractionNotificationMessagePreview;
  readAt: string | null;
  createdAt: string;
}
