process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.STORAGE_ENABLED = 'false';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { StorageService } from './storage-service';
import * as storageServiceModule from './storage-service';
import {
  createUpload,
  purgeExpiredPendingUploads,
  resolveMediaUrl,
  startExpiredPendingUploadCleanup,
} from './upload-service';

const dbModule = await import('../db');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const UPLOAD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OBJECT_KEY = `post/${USER_ID}/${UPLOAD_ID}.png`;

function sampleExpiredPendingUpload(overrides: Partial<{
  id: string;
  objectKey: string;
  expiresAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? UPLOAD_ID,
    ownerId: USER_ID,
    purpose: 'post',
    objectKey: overrides.objectKey ?? OBJECT_KEY,
    mimeType: 'image/png',
    sizeBytes: 4,
    status: 'pending',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    expiresAt: overrides.expiresAt ?? new Date('2026-07-01T00:00:00.000Z'),
  };
}

function mockStorage(): StorageService {
  return {
    ensureBucket: async () => {},
    putObject: async () => {},
    getObject: async () => ({
      body: new ReadableStream<Uint8Array>(),
      mimeType: 'image/png',
      sizeBytes: 4,
    }),
    deleteObject: async () => {},
  };
}

describe('upload-service', () => {
  beforeEach(() => {
    mock.restore();
    storageServiceModule.setStorageService(null);
  });

  test('resolveMediaUrl returns API media path', () => {
    const uploadId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(resolveMediaUrl(uploadId)).toBe(`/api/v1/media/${uploadId}`);
  });

  test('createUpload rejects when storage is disabled', async () => {
    await expect(
      createUpload(USER_ID, 'avatar', {
        buffer: new Uint8Array([1, 2, 3]),
        mimeType: 'image/png',
        size: 3,
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      })
    );
  });

  test('createUpload rejects unsupported mime type', async () => {
    spyOn(storageServiceModule, 'isStorageEnabled').mockReturnValue(true);
    storageServiceModule.setStorageService(mockStorage());

    await expect(
      createUpload(USER_ID, 'post', {
        buffer: new Uint8Array([1, 2, 3]),
        mimeType: 'image/gif',
        size: 3,
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('createUpload rejects oversized avatar files', async () => {
    spyOn(storageServiceModule, 'isStorageEnabled').mockReturnValue(true);
    storageServiceModule.setStorageService(mockStorage());

    const tooLarge = 5 * 1024 * 1024 + 1;
    await expect(
      createUpload(USER_ID, 'avatar', {
        buffer: new Uint8Array(tooLarge),
        mimeType: 'image/png',
        size: tooLarge,
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('createUpload stores metadata and uploads object when enabled', async () => {
    spyOn(storageServiceModule, 'isStorageEnabled').mockReturnValue(true);

    const putObject = mock(async () => {});
    storageServiceModule.setStorageService({
      ...mockStorage(),
      putObject,
    });

    const insertMock = spyOn(dbModule.db, 'insert').mockImplementation(
      () =>
        ({
          values: () => ({
            returning: async () => [
              {
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                ownerId: USER_ID,
                purpose: 'post',
                objectKey: 'pending',
                mimeType: 'image/png',
                sizeBytes: 4,
                status: 'pending',
                createdAt: new Date(),
                expiresAt: new Date(),
              },
            ],
          }),
        }) as never
    );

    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: async () => [
                {
                  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                  ownerId: USER_ID,
                  purpose: 'post',
                  objectKey: `post/${USER_ID}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`,
                  mimeType: 'image/png',
                  sizeBytes: 4,
                  status: 'pending',
                  createdAt: new Date(),
                  expiresAt: new Date(),
                },
              ],
            }),
          }),
        }) as never
    );

    const summary = await createUpload(USER_ID, 'post', {
      buffer: new Uint8Array([1, 2, 3, 4]),
      mimeType: 'image/png',
      size: 4,
    });

    expect(insertMock).toHaveBeenCalled();
    expect(putObject).toHaveBeenCalled();
    expect(summary).toEqual({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      url: '/api/v1/media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      mimeType: 'image/png',
      sizeBytes: 4,
      purpose: 'post',
    });
  });

  test('purgeExpiredPendingUploads returns 0 when storage is disabled', async () => {
    const findMany = spyOn(dbModule.db.query.uploads, 'findMany');

    const purged = await purgeExpiredPendingUploads();

    expect(purged).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  test('purgeExpiredPendingUploads deletes S3 objects and marks uploads deleted', async () => {
    spyOn(storageServiceModule, 'isStorageEnabled').mockReturnValue(true);

    const deleteObject = mock(async () => {});
    storageServiceModule.setStorageService({
      ...mockStorage(),
      deleteObject,
    });

    spyOn(dbModule.db.query.uploads, 'findMany').mockImplementation(
      (async () => [sampleExpiredPendingUpload()]) as never
    );

    const updateMock = spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: async () => [
                {
                  ...sampleExpiredPendingUpload(),
                  status: 'deleted',
                },
              ],
            }),
          }),
        }) as never
    );

    const purged = await purgeExpiredPendingUploads();

    expect(purged).toBe(1);
    expect(deleteObject).toHaveBeenCalledWith(OBJECT_KEY);
    expect(updateMock).toHaveBeenCalled();
  });

  test('purgeExpiredPendingUploads skips S3 delete for placeholder object keys', async () => {
    spyOn(storageServiceModule, 'isStorageEnabled').mockReturnValue(true);

    const deleteObject = mock(async () => {});
    storageServiceModule.setStorageService({
      ...mockStorage(),
      deleteObject,
    });

    spyOn(dbModule.db.query.uploads, 'findMany').mockImplementation(
      (async () => [sampleExpiredPendingUpload({ objectKey: 'pending' })]) as never
    );

    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: async () => [
                {
                  ...sampleExpiredPendingUpload({ objectKey: 'pending' }),
                  status: 'deleted',
                },
              ],
            }),
          }),
        }) as never
    );

    const purged = await purgeExpiredPendingUploads();

    expect(purged).toBe(1);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  test('purgeExpiredPendingUploads returns 0 when no expired pending uploads', async () => {
    spyOn(storageServiceModule, 'isStorageEnabled').mockReturnValue(true);
    storageServiceModule.setStorageService(mockStorage());

    spyOn(dbModule.db.query.uploads, 'findMany').mockImplementation(
      (async () => [] as ReturnType<typeof sampleExpiredPendingUpload>[]) as never
    );

    const purged = await purgeExpiredPendingUploads();

    expect(purged).toBe(0);
  });

  test('purgeExpiredPendingUploads still marks deleted when S3 delete fails', async () => {
    spyOn(storageServiceModule, 'isStorageEnabled').mockReturnValue(true);

    const deleteObject = mock(async () => {
      throw new Error('S3 unavailable');
    });
    storageServiceModule.setStorageService({
      ...mockStorage(),
      deleteObject,
    });

    spyOn(dbModule.db.query.uploads, 'findMany').mockImplementation(
      (async () => [sampleExpiredPendingUpload()]) as never
    );

    spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: async () => [
                {
                  ...sampleExpiredPendingUpload(),
                  status: 'deleted',
                },
              ],
            }),
          }),
        }) as never
    );

    const purged = await purgeExpiredPendingUploads();

    expect(purged).toBe(1);
    expect(deleteObject).toHaveBeenCalledWith(OBJECT_KEY);
  });

  test('purgeExpiredPendingUploads ignores committed uploads that coexist with expired pending', async () => {
    spyOn(storageServiceModule, 'isStorageEnabled').mockReturnValue(true);

    const committedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const committedObjectKey = `post/${USER_ID}/${committedId}.png`;
    const pendingRow = sampleExpiredPendingUpload();
    const committedRow = {
      ...sampleExpiredPendingUpload({
        id: committedId,
        objectKey: committedObjectKey,
      }),
      status: 'committed' as const,
    };

    const deleteObject = mock(async () => {});
    storageServiceModule.setStorageService({
      ...mockStorage(),
      deleteObject,
    });

    // DB where-clause only returns expired pending; committed coexists but is excluded.
    spyOn(dbModule.db.query.uploads, 'findMany').mockImplementation(
      (async () => [pendingRow]) as never
    );

    const updateMock = spyOn(dbModule.db, 'update').mockImplementation(
      () =>
        ({
          set: () => ({
            where: () => ({
              returning: async () => [
                {
                  ...pendingRow,
                  status: 'deleted',
                },
              ],
            }),
          }),
        }) as never
    );

    const purged = await purgeExpiredPendingUploads();

    expect(purged).toBe(1);
    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(deleteObject).toHaveBeenCalledWith(OBJECT_KEY);
    expect(deleteObject).not.toHaveBeenCalledWith(committedObjectKey);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(committedRow.status).toBe('committed');
  });

  test('startExpiredPendingUploadCleanup is a no-op when storage is disabled', () => {
    const stop = startExpiredPendingUploadCleanup();
    expect(typeof stop).toBe('function');
    stop();
  });
});
