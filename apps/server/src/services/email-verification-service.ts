import { eq } from 'drizzle-orm';
import type { ResendVerificationResponse, VerifyEmailResponse } from '@orbitchat/shared-types';
import { db } from '../db';
import { emailVerificationTokens } from '../db/schema/email-verification-tokens';
import { users } from '../db/schema/users';
import { getAppPublicUrl, isEmailVerificationEnabled } from '../lib/feature-flags';
import { generateRefreshToken, hashRefreshToken } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { sendEmail } from './email-service';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const lastResendAtByUserId = new Map<string, number>();

function buildVerificationUrl(token: string): string {
  const url = new URL('/verify-email', getAppPublicUrl());
  url.searchParams.set('token', token);
  return url.toString();
}

export async function createAndSendVerificationEmail(userId: string, email: string): Promise<void> {
  if (!isEmailVerificationEnabled()) {
    return;
  }

  const token = generateRefreshToken();
  const tokenHash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.transaction(async (tx) => {
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
    await tx.insert(emailVerificationTokens).values({
      userId,
      tokenHash,
      expiresAt,
    });
  });

  const verifyUrl = buildVerificationUrl(token);
  const text = [
    'Welcome to Orbitchat!',
    '',
    'Please verify your email address by opening this link:',
    verifyUrl,
    '',
    'This link expires in 24 hours.',
    'If you did not create an account, you can ignore this email.',
  ].join('\n');

  await sendEmail({
    to: email,
    subject: 'Verify your Orbitchat email',
    text,
  });
}

export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  if (!isEmailVerificationEnabled()) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Email verification is disabled', 503);
  }

  const tokenHash = hashRefreshToken(token);
  const now = new Date();

  const record = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.tokenHash, tokenHash),
  });

  if (!record || record.expiresAt <= now) {
    throw new AppError('VALIDATION_ERROR', 'Invalid or expired verification token', 400);
  }

  const [updatedUser] = await db.transaction(async (tx) => {
    const userRows = await tx
      .update(users)
      .set({
        emailVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, record.userId))
      .returning();

    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, record.userId));

    return userRows;
  });

  if (!updatedUser?.emailVerifiedAt) {
    throw new AppError('INTERNAL_ERROR', 'Failed to verify email', 500);
  }

  return {
    success: true,
    emailVerifiedAt: updatedUser.emailVerifiedAt.toISOString(),
  };
}

export async function resendVerificationEmail(userId: string): Promise<ResendVerificationResponse> {
  if (!isEmailVerificationEnabled()) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Email verification is disabled', 503);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || !user.isActive) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  if (user.emailVerifiedAt) {
    throw new AppError('VALIDATION_ERROR', 'Email is already verified', 400);
  }

  const lastSentAt = lastResendAtByUserId.get(userId) ?? 0;
  const elapsed = Date.now() - lastSentAt;
  if (elapsed < RESEND_COOLDOWN_MS) {
    throw new AppError('RATE_LIMITED', 'Please wait before requesting another verification email', 429);
  }

  await createAndSendVerificationEmail(user.id, user.email);
  lastResendAtByUserId.set(userId, Date.now());

  return { success: true };
}

/** Test hook: clear in-memory resend cooldown state. */
export function resetResendCooldownForTests(): void {
  lastResendAtByUserId.clear();
}
