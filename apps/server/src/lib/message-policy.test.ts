import { describe, expect, test } from 'bun:test';
import { MESSAGE_EDIT_WINDOW_MS, MESSAGE_RECALL_WINDOW_MS } from './message-policy';

describe('message-policy', () => {
  test('uses a 3 minute recall window', () => {
    expect(MESSAGE_RECALL_WINDOW_MS).toBe(3 * 60 * 1000);
  });

  test('uses a 15 minute edit window', () => {
    expect(MESSAGE_EDIT_WINDOW_MS).toBe(15 * 60 * 1000);
  });
});
