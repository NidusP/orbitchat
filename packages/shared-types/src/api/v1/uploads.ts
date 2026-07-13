import type { UploadPurpose, UploadSummary } from '../../domain/upload';

/** POST /api/v1/uploads — multipart field `purpose`. */
export interface CreateUploadRequest {
  purpose: UploadPurpose;
}

/** POST /api/v1/uploads response body `data`. */
export type CreateUploadResponse = UploadSummary;

/** GET /api/v1/media/:uploadId — binary stream; no JSON envelope. */
export interface GetMediaParams {
  uploadId: string;
}
