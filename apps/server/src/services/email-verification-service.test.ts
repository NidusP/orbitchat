process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, setSystemTime, spyOn, test } from 'bun:test';
import { AppError } from '../lib/errors';

const cryptoLib = await import('../lib/crypto');
const emailService = await import('./email-service');
const featureFlags = await import('../lib/feature-flags');
const dbModule = await import('../db');
const emailVerificationService = await import('./email-verification-service');

const USER_ID = '11111111-1111-4111-8111-111111111111';

function assertAppError(error: unknown, code: string, statusCode: number): void {
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  expect((error as AppError).statusCode).toBe(statusCode);
}

describe('email-verification-service', () => {
  beforeEach(() => {
    mock.restore();
    setSystemTime(new Date('2026-07-13T12:00:00.000Z'));
    emailVerificationService.resetResendCooldownForTests();

    spyOn(featureFlags, 'isEmailVerificationEnabled').mockReturnValue(true);
    spyOn(featureFlags, 'getAppPublicUrl').mockReturnValue('http://localhost:3000');

    spyOn(cryptoLib, 'generateRefreshToken').mockImplementation(() => 'raw-verification-token');
    spyOn(cryptoLib, 'hashRefreshToken').mockImplementation((token: string) => `hash:${token}`);
    spyOn(emailService, 'sendEmail').mockImplementation(async () => {});

    spyOn(dbModule.db, 'transaction').mockImplementation(async (callback) => {
      const tx = {
        delete: () => ({
          where: () => Promise.resolve(),
        }),
        insert: () => ({
          values: () => Promise.resolve(),
        }),
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => [
                {
                  id: USER_ID,
                  username: 'orbit',
                  email: 'orbit@example.com',
                  passwordHash: 'hash',
                  isActive: true,
                  emailVerifiedAt: new Date('2026-07-13T12:00:00.000Z'),
                  createdAt: new Date('2026-06-20T00:00:00.000Z'),
                  updatedAt: new Date('2026-07-13T12:00:00.000Z'),
                },
              ],
            }),
          }),
        }),
      };
      return callback(tx as never);
    });

    spyOn(dbModule.db.query.emailVerificationTokens, 'findFirst').mockImplementation(
      () =>
        Promise.resolve({
          id: 'token-1',
          userId: USER_ID,
          tokenHash: 'hash:raw-verification-token',
          expiresAt: new Date('2026-07-14T12:00:00.000Z'),
          createdAt: new Date('2026-07-13T12:00:00.000Z'),
        }) as never
    );

    spyOn(dbModule.db.query.users, 'findFirst').mockImplementation(
      () =>
        Promise.resolve({
          id: USER_ID,
          username: 'orbit',
          email: 'orbit@example.com',
          passwordHash: 'hash',
          isActive: true,
          emailVerifiedAt: null,
          createdAt: new Date('2026-06-20T00:00:00.000Z'),
          updatedAt: new Date('2026-06-20T00:00:00.000Z'),
        }) as never
    );
  });

  test('createAndSendVerificationEmail sends a plain-text verification link', async () => {
    const sendEmailSpy = spyOn(emailService, 'sendEmail');

    await emailVerificationService.createAndSendVerificationEmail(USER_ID, 'orbit@example.com');

    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'orbit@example.com',
        subject: 'Verify your Orbitchat email',
        text: expect.stringContaining(
          'http://localhost:3000/verify-email?token=raw-verification-token'
        ),
      })
    );
  });

  test('verifyEmail marks the user verified and returns timestamp', async () => {
    const result = await emailVerificationService.verifyEmail('raw-verification-token');

    expect(result.success).toBe(true);
    expect(result.emailVerifiedAt).toBe('2026-07-13T12:00:00.000Z');
  });

  test('verifyEmail rejects expired tokens', async () => {
    spyOn(dbModule.db.query.emailVerificationTokens, 'findFirst').mockImplementation(
      () =>
        Promise.resolve({
          id: 'token-1',
          userId: USER_ID,
          tokenHash: 'hash:raw-verification-token',
          expiresAt: new Date('2026-07-12T12:00:00.000Z'),
          createdAt: new Date('2026-07-11T12:00:00.000Z'),
        }) as never
    );

    try {
      await emailVerificationService.verifyEmail('raw-verification-token');
      throw new Error('Expected verifyEmail to throw');
    } catch (error) {
      assertAppError(error, 'VALIDATION_ERROR', 400);
    }
  });

  test('resendVerificationEmail rate limits repeat requests', async () => {
    await emailVerificationService.resendVerificationEmail(USER_ID);

    try {
      await emailVerificationService.resendVerificationEmail(USER_ID);
      throw new Error('Expected resendVerificationEmail to throw');
    } catch (error) {
      assertAppError(error, 'RATE_LIMITED', 429);
    }
  });
});
