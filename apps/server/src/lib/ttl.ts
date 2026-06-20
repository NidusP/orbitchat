const TTL_PATTERN = /^(\d+)([smhd])$/;

const MULTIPLIERS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};

/** Parse env-style TTL strings such as `15m`, `7d` into seconds. */
export function parseTtlSeconds(ttl: string): number {
  const match = TTL_PATTERN.exec(ttl.trim());
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}`);
  }

  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = MULTIPLIERS[unit];

  if (value <= 0 || multiplier === undefined) {
    throw new Error(`Invalid TTL format: ${ttl}`);
  }

  return value * multiplier;
}

export function ttlToDate(ttl: string, from: Date = new Date()): Date {
  const seconds = parseTtlSeconds(ttl);
  return new Date(from.getTime() + seconds * 1000);
}
