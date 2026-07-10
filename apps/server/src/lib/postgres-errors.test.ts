import { describe, expect, test } from 'bun:test';
import { getPostgresErrorCode, isUndefinedTable, isUniqueViolation } from './postgres-errors';

describe('postgres-errors', () => {
  test('reads postgres code from DrizzleQueryError cause chain', () => {
    const postgresError = { code: '42P01', message: 'relation does not exist' };
    const drizzleError = { message: 'Failed query', cause: postgresError };

    expect(getPostgresErrorCode(drizzleError)).toBe('42P01');
    expect(isUndefinedTable(drizzleError)).toBe(true);
  });

  test('detects unique violations on nested errors', () => {
    const postgresError = { code: '23505', message: 'duplicate key' };
    const wrapped = { cause: postgresError };

    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  test('returns false for unrelated errors', () => {
    expect(isUndefinedTable(new Error('boom'))).toBe(false);
    expect(isUniqueViolation({ code: '40001' })).toBe(false);
  });
});
