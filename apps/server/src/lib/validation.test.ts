import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { validationErrorFromZod } from './validation';

describe('validationErrorFromZod', () => {
  test('maps the first zod issue to a validation app error', () => {
    const parsed = z
      .object({
        email: z.string().email('Invalid email format'),
      })
      .safeParse({ email: 'bad' });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error('expected validation failure');
    }

    const error = validationErrorFromZod(parsed.error);

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid email format');
    expect(error.details).toEqual({
      field: 'email',
      issues: [{ path: ['email'], message: 'Invalid email format' }],
    });
  });
});
