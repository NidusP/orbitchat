import { z } from 'zod';
import { cursorQuerySchema } from './posts';

export { cursorQuerySchema as notificationListQuerySchema };
export type NotificationListQueryInput = z.infer<typeof cursorQuerySchema>;

export const markNotificationsReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).optional(),
});

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
