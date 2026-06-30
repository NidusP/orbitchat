import { describe, expect, test } from 'bun:test';
import {
  buildNextCursor,
  decodeTimelineCursor,
  encodeTimelineCursor,
  trimToPage,
} from './cursor';

describe('timeline cursor', () => {
  test('encodes and decodes', () => {
    const createdAt = new Date('2026-06-23T10:00:00.000Z');
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const cursor = encodeTimelineCursor(createdAt, id);
    const decoded = decodeTimelineCursor(cursor);
    expect(decoded.id).toBe(id);
    expect(decoded.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  test('buildNextCursor returns null when within page', () => {
    const rows = [{ createdAt: new Date(), id: 'a' }];
    expect(buildNextCursor(rows, 20)).toBeNull();
  });

  test('trimToPage keeps limit items', () => {
    expect(trimToPage([1, 2, 3], 2)).toEqual([1, 2]);
  });
});
