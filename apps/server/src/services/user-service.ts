import { eq, or } from 'drizzle-orm';
import { db } from '../db';
import { profiles } from '../db/schema/profiles';
import { users } from '../db/schema/users';
import { AppError } from '../lib/errors';
import { hashPassword } from '../lib/crypto';
import { toProfileDto, toUserDto } from '../lib/mappers';
import type { RegisterInput } from '../schemas/auth';
import type { UpdateProfileInput, UpdateUserInput } from '../schemas/users';

export async function findUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: eq(users.email, email),
  });
}

export async function findUserById(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

export async function findProfileByUserId(userId: string) {
  return db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });
}

export async function getUserById(userId: string) {
  const user = await findUserById(userId);

  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  return toUserDto(user);
}

export async function getProfileByUserId(userId: string) {
  const profile = await findProfileByUserId(userId);

  if (!profile) {
    throw new AppError('NOT_FOUND', 'Profile not found', 404);
  }

  return toProfileDto(profile);
}

export async function updateUser(userId: string, input: UpdateUserInput) {
  if (input.email) {
    const emailConflict = await db.query.users.findFirst({
      where: eq(users.email, input.email),
    });
    if (emailConflict && emailConflict.id !== userId) {
      throw new AppError('CONFLICT', 'User already exists with this email', 409, {
        field: 'email',
      });
    }
  }

  if (input.username) {
    const usernameConflict = await db.query.users.findFirst({
      where: eq(users.username, input.username),
    });
    if (usernameConflict && usernameConflict.id !== userId) {
      throw new AppError('CONFLICT', 'User already exists with this username', 409, {
        field: 'username',
      });
    }
  }

  const [updated] = await db
    .update(users)
    .set({
      ...(input.username !== undefined ? { username: input.username } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  return toUserDto(updated);
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const [updated] = await db
    .update(profiles)
    .set({
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId))
    .returning();

  if (!updated) {
    throw new AppError('NOT_FOUND', 'Profile not found', 404);
  }

  return toProfileDto(updated);
}

export async function registerUser(input: RegisterInput) {
  const existing = await db.query.users.findFirst({
    where: or(eq(users.email, input.email), eq(users.username, input.username)),
  });

  if (existing) {
    const field = existing.email === input.email ? 'email' : 'username';
    throw new AppError('CONFLICT', `User already exists with this ${field}`, 409, { field });
  }

  const passwordHash = await hashPassword(input.password);

  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        username: input.username,
        email: input.email,
        passwordHash,
      })
      .returning();

    const [profile] = await tx
      .insert(profiles)
      .values({
        userId: user.id,
        displayName: input.displayName,
      })
      .returning();

    return { user, profile };
  });

  return {
    user: toUserDto(created.user),
    profile: toProfileDto(created.profile),
  };
}

export async function assertActiveUser(userId: string) {
  const user = await findUserById(userId);

  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Invalid credentials', 401);
  }

  if (!user.isActive) {
    throw new AppError('FORBIDDEN', 'Account is inactive', 403);
  }

  return user;
}
