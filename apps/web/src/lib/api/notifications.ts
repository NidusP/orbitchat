import type {
  CursorPageParams,
  MarkNotificationsReadRequest,
  MarkNotificationsReadResponse,
  NotificationListResponse,
  NotificationUnreadCountResponse,
} from '@orbitchat/shared-types';
import { apiRequest } from './client';

function buildQuery(params: CursorPageParams): string {
  const search = new URLSearchParams();
  if (params.cursor) {
    search.set('cursor', params.cursor);
  }
  if (params.limit !== undefined) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listNotifications(
  params: CursorPageParams = {}
): Promise<NotificationListResponse> {
  return apiRequest<NotificationListResponse>(`/api/v1/notifications${buildQuery(params)}`);
}

export async function getNotificationUnreadCount(): Promise<NotificationUnreadCountResponse> {
  return apiRequest<NotificationUnreadCountResponse>('/api/v1/notifications/unread-count');
}

export async function markNotificationsRead(
  body: MarkNotificationsReadRequest = {}
): Promise<MarkNotificationsReadResponse> {
  return apiRequest<MarkNotificationsReadResponse>('/api/v1/notifications/read', {
    method: 'PATCH',
    body,
  });
}
