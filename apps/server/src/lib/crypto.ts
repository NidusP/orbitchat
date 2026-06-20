import { createHash, randomBytes } from 'node:crypto';

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: 10,
  });
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return Bun.password.verify(password, passwordHash);
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
