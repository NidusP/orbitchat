import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { successResponse } from '../../lib/response';
import { zodValidationHook } from '../../lib/zod-hook';
import { authMiddleware } from '../../middleware/auth';
import {
  markNotificationsReadSchema,
  notificationListQuerySchema,
} from '../../schemas/notifications';
import {
  getUnreadNotificationCount,
  listNotifications,
  markNotificationsRead,
} from '../../services/notification-service';

export const notificationsRouter = new Hono();

notificationsRouter.get('/', authMiddleware, zValidator('query', notificationListQuerySchema, zodValidationHook), async (c) => {
  const auth = c.get('auth');
  const query = c.req.valid('query');
  const page = await listNotifications(auth.userId, query);
  return c.json(successResponse(page), 200);
});

notificationsRouter.get('/unread-count', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const count = await getUnreadNotificationCount(auth.userId);
  return c.json(successResponse({ count }), 200);
});

notificationsRouter.patch(
  '/read',
  authMiddleware,
  zValidator('json', markNotificationsReadSchema, zodValidationHook),
  async (c) => {
    const auth = c.get('auth');
    const input = c.req.valid('json');
    const updated = await markNotificationsRead(auth.userId, input);
    return c.json(successResponse({ updated }), 200);
  }
);
