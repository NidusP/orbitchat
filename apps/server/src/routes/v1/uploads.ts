import { Hono } from 'hono';
import type { UploadPurpose } from '@orbitchat/shared-types';
import { AppError } from '../../lib/errors';
import { successResponse } from '../../lib/response';
import { authMiddleware } from '../../middleware/auth';
import { isStorageEnabled } from '../../services/storage-service';
import { createUpload } from '../../services/upload-service';

export const uploadsRouter = new Hono();

const VALID_PURPOSES: UploadPurpose[] = ['avatar', 'post', 'message', 'group_avatar'];

function parsePurpose(value: unknown): UploadPurpose {
  if (typeof value !== 'string' || !VALID_PURPOSES.includes(value as UploadPurpose)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid upload purpose', 400, {
      field: 'purpose',
      allowed: VALID_PURPOSES,
    });
  }
  return value as UploadPurpose;
}

async function fileToBuffer(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

uploadsRouter.post('/', authMiddleware, async (c) => {
  if (!isStorageEnabled()) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Object storage is not enabled', 503);
  }

  const body = await c.req.parseBody();
  const purpose = parsePurpose(body.purpose);
  const rawFile = body.file;

  if (!(rawFile instanceof File)) {
    throw new AppError('VALIDATION_ERROR', 'File is required', 400, { field: 'file' });
  }

  if (rawFile.size <= 0) {
    throw new AppError('VALIDATION_ERROR', 'File is empty', 400, { field: 'file' });
  }

  const auth = c.get('auth');
  const buffer = await fileToBuffer(rawFile);
  const summary = await createUpload(auth.userId, purpose, {
    buffer,
    mimeType: rawFile.type || 'application/octet-stream',
    size: rawFile.size,
  });

  return c.json(successResponse(summary), 201);
});
