import type { CursorPage } from '../cursor-pagination';
import type { InteractionNotification } from '../../domain/notification';

export type NotificationListResponse = CursorPage<InteractionNotification>;

export interface NotificationUnreadCountResponse {
  count: number;
}

export interface MarkNotificationsReadRequest {
  notificationIds?: string[];
}

export interface MarkNotificationsReadResponse {
  updated: number;
}
