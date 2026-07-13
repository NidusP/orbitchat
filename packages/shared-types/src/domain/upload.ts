export type UploadPurpose = 'avatar' | 'post';

export type UploadStatus = 'pending' | 'committed' | 'deleted';

/** Upload metadata returned after POST /api/v1/uploads. */
export interface UploadSummary {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  purpose: UploadPurpose;
}

/** Media item attached to a post in feed/detail responses. */
export interface PostMediaItem {
  id: string;
  uploadId: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
}
