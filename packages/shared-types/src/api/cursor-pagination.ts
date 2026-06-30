/**
 * Cursor-based pagination (ADR 11).
 * Sort key: (createdAt DESC, id DESC).
 */

export const DEFAULT_CURSOR_LIMIT = 20;
export const MAX_CURSOR_LIMIT = 50;

export interface CursorPageParams {
  cursor?: string;
  limit?: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function clampCursorLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_CURSOR_LIMIT;
  }
  return Math.min(Math.max(1, limit), MAX_CURSOR_LIMIT);
}
