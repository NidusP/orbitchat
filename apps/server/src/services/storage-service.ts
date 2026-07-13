import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../env';
import { AppError } from '../lib/errors';

export interface StorageObject {
  body: ReadableStream<Uint8Array>;
  mimeType: string;
  sizeBytes: number | null;
}

export interface StorageService {
  ensureBucket(): Promise<void>;
  putObject(key: string, body: Uint8Array, mimeType: string): Promise<void>;
  getObject(key: string): Promise<StorageObject>;
  deleteObject(key: string): Promise<void>;
}

class S3StorageService implements StorageService {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string
  ) {}

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async putObject(key: string, body: Uint8Array, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
      })
    );
  }

  async getObject(key: string): Promise<StorageObject> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new AppError('NOT_FOUND', 'Object not found', 404);
    }

    const body = response.Body.transformToWebStream() as ReadableStream<Uint8Array>;

    return {
      body,
      mimeType: response.ContentType ?? 'application/octet-stream',
      sizeBytes: response.ContentLength ?? null,
    };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }
}

let storageService: StorageService | null = null;

function createDefaultStorageService(): StorageService {
  if (!env.STORAGE_ENABLED) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Object storage is not enabled', 503);
  }

  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY!,
      secretAccessKey: env.S3_SECRET_KEY!,
    },
  });

  return new S3StorageService(client, env.S3_BUCKET);
}

export function getStorageService(): StorageService {
  if (!storageService) {
    storageService = createDefaultStorageService();
  }
  return storageService;
}

/** Override storage for tests; pass `null` to reset. */
export function setStorageService(service: StorageService | null): void {
  storageService = service;
}

export function isStorageEnabled(): boolean {
  return env.STORAGE_ENABLED;
}

export async function ensureBucketOnStartup(): Promise<void> {
  if (!env.STORAGE_ENABLED) {
    return;
  }
  await getStorageService().ensureBucket();
}
