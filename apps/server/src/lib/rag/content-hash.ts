import { createHash } from 'node:crypto';

/** SHA-256 hex digest of indexed chunk text for skip-if-unchanged RAG indexing. */
export function hashChunkContent(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
