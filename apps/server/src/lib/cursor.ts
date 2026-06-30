import { AppError } from './errors';

export interface TimelineCursor {
  createdAt: Date;
  id: string;
}

const CURSOR_SEPARATOR = '|';

export function encodeTimelineCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}${CURSOR_SEPARATOR}${id}`).toString('base64url');
}

export function decodeTimelineCursor(raw: string): TimelineCursor {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const separatorIndex = decoded.lastIndexOf(CURSOR_SEPARATOR);
    if (separatorIndex === -1) {
      throw new Error('invalid cursor');
    }

    const createdAtRaw = decoded.slice(0, separatorIndex);
    const id = decoded.slice(separatorIndex + 1);
    const createdAt = new Date(createdAtRaw);

    if (Number.isNaN(createdAt.getTime()) || id.length === 0) {
      throw new Error('invalid cursor');
    }

    return { createdAt, id };
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Invalid cursor', 400, { field: 'cursor' });
  }
}

export function buildNextCursor<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number
): string | null {
  if (rows.length <= limit) {
    return null;
  }

  const last = rows[limit - 1];
  if (!last) {
    return null;
  }

  return encodeTimelineCursor(last.createdAt, last.id);
}

export function trimToPage<T>(rows: T[], limit: number): T[] {
  return rows.length > limit ? rows.slice(0, limit) : rows;
}
