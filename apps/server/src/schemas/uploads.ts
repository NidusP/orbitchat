import { z } from 'zod';

export const uploadPurposeSchema = z.enum(['avatar', 'post', 'message', 'group_avatar'], {
  message: 'Purpose must be avatar, post, message, or group_avatar',
});

export type UploadPurposeInput = z.infer<typeof uploadPurposeSchema>;
