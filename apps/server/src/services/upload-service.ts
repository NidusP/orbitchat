import { and, eq, inArray } from 'drizzle-orm';
import type { PostMediaItem, UploadPurpose, UploadSummary } from '@orbitchat/shared-types';
import { db } from '../db';
import { postMedia } from '../db/schema/post-media';
import { profiles } from '../db/schema/profiles';
import { uploads } from '../db/schema/uploads';
import { AppError } from '../lib/errors';
import { getStorageService, isStorageEnabled } from './storage-service';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const MAX_BYTES_BY_PURPOSE: Record<UploadPurpose, number> = {
  avatar: 5 * 1024 * 1024,
  post: 10 * 1024 * 1024,
};

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_POST_MEDIA = 4;

const MIME_EXTENSION: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface UploadFileInput {
  buffer: Uint8Array;
  mimeType: string;
  size: number;
}

function assertStorageEnabled(): void {
  if (!isStorageEnabled()) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Object storage is not enabled', 503);
  }
}

function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

function buildObjectKey(purpose: UploadPurpose, userId: string, uploadId: string, mimeType: AllowedMimeType): string {
  const ext = MIME_EXTENSION[mimeType];
  return `${purpose}/${userId}/${uploadId}.${ext}`;
}

export function resolveMediaUrl(uploadId: string): string {
  return `/api/v1/media/${uploadId}`;
}

function toUploadSummary(row: typeof uploads.$inferSelect): UploadSummary {
  return {
    id: row.id,
    url: resolveMediaUrl(row.id),
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    purpose: row.purpose as UploadPurpose,
  };
}

function validateUploadFile(purpose: UploadPurpose, file: UploadFileInput): AllowedMimeType {
  if (!isAllowedMimeType(file.mimeType)) {
    throw new AppError('VALIDATION_ERROR', 'Unsupported image type', 400, {
      field: 'file',
      allowed: ALLOWED_MIME_TYPES,
    });
  }

  const maxBytes = MAX_BYTES_BY_PURPOSE[purpose];
  if (file.size > maxBytes) {
    throw new AppError('VALIDATION_ERROR', `File exceeds ${purpose} size limit`, 400, {
      field: 'file',
      maxBytes,
    });
  }

  if (file.buffer.byteLength !== file.size) {
    throw new AppError('VALIDATION_ERROR', 'File size mismatch', 400, { field: 'file' });
  }

  return file.mimeType;
}

export async function createUpload(
  userId: string,
  purpose: UploadPurpose,
  file: UploadFileInput
): Promise<UploadSummary> {
  assertStorageEnabled();

  const mimeType = validateUploadFile(purpose, file);
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS);

  const [created] = await db
    .insert(uploads)
    .values({
      ownerId: userId,
      purpose,
      objectKey: 'pending',
      mimeType,
      sizeBytes: file.size,
      status: 'pending',
      expiresAt,
    })
    .returning();

  if (!created) {
    throw new AppError('INTERNAL_ERROR', 'Failed to create upload', 500);
  }

  const objectKey = buildObjectKey(purpose, userId, created.id, mimeType);

  try {
    await getStorageService().putObject(objectKey, file.buffer, mimeType);
    const [updated] = await db
      .update(uploads)
      .set({ objectKey })
      .where(eq(uploads.id, created.id))
      .returning();

    if (!updated) {
      throw new AppError('INTERNAL_ERROR', 'Failed to finalize upload', 500);
    }

    return toUploadSummary(updated);
  } catch (error: unknown) {
    await db.delete(uploads).where(eq(uploads.id, created.id));
    throw error;
  }
}

async function getOwnedPendingUploads(
  uploadIds: string[],
  userId: string,
  purpose: UploadPurpose
): Promise<Array<typeof uploads.$inferSelect>> {
  if (uploadIds.length === 0) {
    return [];
  }

  const rows = await db.query.uploads.findMany({
    where: and(
      inArray(uploads.id, uploadIds),
      eq(uploads.ownerId, userId),
      eq(uploads.purpose, purpose),
      eq(uploads.status, 'pending')
    ),
  });

  if (rows.length !== uploadIds.length) {
    throw new AppError('VALIDATION_ERROR', 'One or more uploads are invalid or not owned by you', 400, {
      field: purpose === 'post' ? 'uploadIds' : 'avatarUploadId',
    });
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  return uploadIds.map((id) => {
    const row = byId.get(id);
    if (!row) {
      throw new AppError('VALIDATION_ERROR', 'Upload not found', 400);
    }
    return row;
  });
}

export async function commitUploads(
  uploadIds: string[],
  userId: string,
  purpose: UploadPurpose
): Promise<void> {
  if (uploadIds.length === 0) {
    return;
  }

  const rows = await getOwnedPendingUploads(uploadIds, userId, purpose);

  await db
    .update(uploads)
    .set({
      status: 'committed',
      expiresAt: null,
    })
    .where(
      and(
        inArray(
          uploads.id,
          rows.map((row) => row.id)
        ),
        eq(uploads.ownerId, userId)
      )
    );
}

export async function getCommittedMediaStream(uploadId: string): Promise<{
  body: ReadableStream<Uint8Array>;
  mimeType: string;
}> {
  const row = await db.query.uploads.findFirst({
    where: and(eq(uploads.id, uploadId), eq(uploads.status, 'committed')),
  });

  if (!row) {
    throw new AppError('NOT_FOUND', 'Media not found', 404);
  }

  assertStorageEnabled();
  const object = await getStorageService().getObject(row.objectKey);

  return {
    body: object.body,
    mimeType: row.mimeType,
  };
}

export async function setAvatarFromUpload(userId: string, uploadId: string): Promise<string> {
  await commitUploads([uploadId], userId, 'avatar');
  const avatarUrl = resolveMediaUrl(uploadId);

  const [updated] = await db
    .update(profiles)
    .set({
      avatarUrl,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId))
    .returning();

  if (!updated) {
    throw new AppError('NOT_FOUND', 'Profile not found', 404);
  }

  return avatarUrl;
}

export async function linkPostMedia(
  postId: string,
  userId: string,
  uploadIds: string[]
): Promise<PostMediaItem[]> {
  if (uploadIds.length === 0) {
    return [];
  }

  if (uploadIds.length > MAX_POST_MEDIA) {
    throw new AppError('VALIDATION_ERROR', 'A post can have at most 4 images', 400, {
      field: 'uploadIds',
      max: MAX_POST_MEDIA,
    });
  }

  const uniqueIds = [...new Set(uploadIds)];
  if (uniqueIds.length !== uploadIds.length) {
    throw new AppError('VALIDATION_ERROR', 'Duplicate upload ids are not allowed', 400, {
      field: 'uploadIds',
    });
  }

  await getOwnedPendingUploads(uniqueIds, userId, 'post');

  const mediaRows = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(postMedia)
      .values(
        uniqueIds.map((uploadId, index) => ({
          postId,
          uploadId,
          sortOrder: index,
        }))
      )
      .returning();

    await tx
      .update(uploads)
      .set({
        status: 'committed',
        expiresAt: null,
      })
      .where(and(inArray(uploads.id, uniqueIds), eq(uploads.ownerId, userId)));

    return inserted;
  });

  const uploadRows = await db.query.uploads.findMany({
    where: inArray(uploads.id, uniqueIds),
  });
  const uploadById = new Map(uploadRows.map((row) => [row.id, row]));

  return mediaRows.map((row) => {
    const upload = uploadById.get(row.uploadId);
    if (!upload) {
      throw new AppError('INTERNAL_ERROR', 'Upload metadata missing after commit', 500);
    }

    return {
      id: row.id,
      uploadId: row.uploadId,
      url: resolveMediaUrl(row.uploadId),
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      sortOrder: row.sortOrder,
    };
  });
}
