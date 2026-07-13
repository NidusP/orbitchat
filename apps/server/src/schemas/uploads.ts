import { z } from 'zod';

export const uploadPurposeSchema = z.enum(['avatar', 'post'], {
  message: 'Purpose must be avatar or post',
});

export type UploadPurposeInput = z.infer<typeof uploadPurposeSchema>;
