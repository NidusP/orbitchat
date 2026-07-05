/**
 * Ensure local dev test users exist and passwords match fixtures.
 * Usage: pnpm --dir apps/server db:reset-dev-user
 */
import { eq, or, sql } from 'drizzle-orm';
import { db } from '../src/db';
import { profiles } from '../src/db/schema/profiles';
import { users } from '../src/db/schema/users';
import { hashPassword } from '../src/lib/crypto';
import { DEV_TEST_USERS } from '../src/lib/dev-test-user';

async function ensureDevTestUser(fixture: (typeof DEV_TEST_USERS)[number]): Promise<void> {
  const passwordHash = await hashPassword(fixture.password);

  const existing = await db.query.users.findFirst({
    where: or(eq(users.email, fixture.email), eq(users.username, fixture.username)),
  });

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(sql`${users.email} = ${fixture.email}`);
    console.log(`Reset password for ${existing.username} <${existing.email}>`);
    return;
  }

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        username: fixture.username,
        email: fixture.email,
        passwordHash,
      })
      .returning();

    if (!user) {
      throw new Error(`Failed to create dev user ${fixture.username}`);
    }

    await tx.insert(profiles).values({
      userId: user.id,
      displayName: fixture.displayName,
    });
  });

  console.log(`Created dev user ${fixture.username} <${fixture.email}>`);
}

async function main(): Promise<void> {
  for (const fixture of DEV_TEST_USERS) {
    await ensureDevTestUser(fixture);
  }
  console.log(`Password for all: ${DEV_TEST_USERS[0].password}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
