/**
 * Reset the local dev test user password in Postgres.
 * Usage: pnpm --dir apps/server db:reset-dev-user
 *
 * Requires DATABASE_URL and a running Postgres (e.g. im-postgres).
 */
import { sql } from 'drizzle-orm';
import { db } from '../src/db';
import { users } from '../src/db/schema/users';
import { hashPassword } from '../src/lib/crypto';
import { DEV_TEST_USER_EMAIL, DEV_TEST_USER_PASSWORD } from '../src/lib/dev-test-user';

async function main(): Promise<void> {
  const passwordHash = await hashPassword(DEV_TEST_USER_PASSWORD);
  const result = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(sql`${users.email} = ${DEV_TEST_USER_EMAIL}`)
    .returning({ email: users.email, username: users.username });

  if (result.length === 0) {
    console.error(`No user found for ${DEV_TEST_USER_EMAIL}`);
    process.exit(1);
  }

  const row = result[0];
  console.log(`Reset password for ${row?.username} <${row?.email}>`);
  console.log(`Use password: ${DEV_TEST_USER_PASSWORD}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
