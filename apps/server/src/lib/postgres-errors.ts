function readErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if ('code' in error && typeof error.code === 'string') {
    return error.code;
  }

  if ('cause' in error) {
    return readErrorCode((error as { cause: unknown }).cause);
  }

  return undefined;
}

export function getPostgresErrorCode(error: unknown): string | undefined {
  return readErrorCode(error);
}

export function isUniqueViolation(error: unknown): boolean {
  return getPostgresErrorCode(error) === '23505';
}

/** Postgres undefined_table — migration not applied yet */
export function isUndefinedTable(error: unknown): boolean {
  return getPostgresErrorCode(error) === '42P01';
}
