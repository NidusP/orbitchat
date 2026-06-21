import { describe, expect, test } from 'bun:test';
import { parseApiError } from './errors';

describe('parseApiError', () => {
  test('parses standard error responses', () => {
    const error = parseApiError(
      {
        code: 'VALIDATION_ERROR',
        message: 'Invalid email format',
        details: { field: 'email' },
        timestamp: '2026-06-21T00:00:00.000Z',
      },
      400
    );

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid email format');
    expect(error.status).toBe(400);
  });

  test('parses legacy zod validator responses', () => {
    const error = parseApiError(
      {
        success: false,
        error: {
          issues: [{ message: 'Password does not meet requirements', path: ['password'] }],
        },
      } as never,
      400
    );

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Password does not meet requirements');
    expect(error.status).toBe(400);
  });
});
