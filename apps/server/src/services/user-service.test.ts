process.env.DATABASE_URL = 'postgresql://orbitchat:orbitchat@localhost:5432/orbitchat';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '30d';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Profile } from '../db/schema/profiles';
import type { User } from '../db/schema/users';
import {
  assertPublicUser,
  getUserById,
  updateProfile,
  updateUser,
} from './user-service';

const USER_ID = '11111111-1111-4111-8111-111111111111';

const dbModule = await import('../db');

function sampleUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    username: 'orbit',
    email: 'orbit@example.com',
    passwordHash: 'hash',
    isActive: true,
    emailVerifiedAt: new Date('2026-06-20T00:00:00.000Z'),
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    ...overrides,
  };
}

function sampleProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'profile-1',
    userId: USER_ID,
    displayName: 'Orbit User',
    bio: 'Hello Orbit',
    avatarUrl: null,
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
    ...overrides,
  };
}

describe('user-service robustness', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('assertPublicUser rejects inactive users as not found', async () => {
    spyOn(dbModule.db.query.users, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleUser({ isActive: false })) as never
    );

    await expect(assertPublicUser(USER_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'NOT_FOUND',
        statusCode: 404,
      })
    );
  });

  test('getUserById rejects inactive users', async () => {
    spyOn(dbModule.db.query.users, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleUser({ isActive: false })) as never
    );

    await expect(getUserById(USER_ID)).rejects.toEqual(
      expect.objectContaining({
        code: 'NOT_FOUND',
        statusCode: 404,
      })
    );
  });

  test('updateUser rejects unchanged fields', async () => {
    spyOn(dbModule.db.query.users, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleUser()) as never
    );

    await expect(
      updateUser(USER_ID, { username: 'orbit', email: 'orbit@example.com' })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  test('updateProfile rejects unchanged fields', async () => {
    spyOn(dbModule.db.query.users, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleUser()) as never
    );
    spyOn(dbModule.db.query.profiles, 'findFirst').mockImplementation(
      () => Promise.resolve(sampleProfile()) as never
    );

    await expect(
      updateProfile(USER_ID, {
        displayName: 'Orbit User',
        bio: 'Hello Orbit',
        avatarUrl: null,
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });
});
