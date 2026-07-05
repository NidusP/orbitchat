import { AppError } from './errors';

export interface ConversationListCursor {
  sortAt: Date;
  id: string;
}

const CURSOR_SEPARATOR = '|';

export function encodeConversationListCursor(sortAt: Date, id: string): string {
  return Buffer.from(`${sortAt.toISOString()}${CURSOR_SEPARATOR}${id}`).toString('base64url');
}

export function decodeConversationListCursor(raw: string): ConversationListCursor {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const separatorIndex = decoded.lastIndexOf(CURSOR_SEPARATOR);
    if (separatorIndex === -1) {
      throw new Error('invalid cursor');
    }

    const sortAtRaw = decoded.slice(0, separatorIndex);
    const id = decoded.slice(separatorIndex + 1);
    const sortAt = new Date(sortAtRaw);

    if (Number.isNaN(sortAt.getTime()) || id.length === 0) {
      throw new Error('invalid cursor');
    }

    return { sortAt, id };
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Invalid cursor', 400, { field: 'cursor' });
  }
}

export function buildConversationListNextCursor(
  rows: Array<{ sortAt: Date; id: string }>,
  limit: number
): string | null {
  if (rows.length <= limit) {
    return null;
  }

  const last = rows[limit - 1];
  if (!last) {
    return null;
  }

  return encodeConversationListCursor(last.sortAt, last.id);
}
