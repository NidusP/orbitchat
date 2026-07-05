/** Local dev fixtures — keep in sync with apps/server/src/lib/dev-test-user.ts */

export const DEV_TEST_USER_PASSWORD = 'Password123!';

export interface DevTestUserFixture {
  email: string;
  username: string;
  displayName: string;
  password: string;
}

export const DEV_TEST_USERS: readonly DevTestUserFixture[] = [
  {
    email: 'test@test.com',
    username: 'test_popolus',
    displayName: 'test_huyang',
    password: DEV_TEST_USER_PASSWORD,
  },
  {
    email: 'test2@test.com',
    username: 'test_popolus2',
    displayName: 'test_user2',
    password: DEV_TEST_USER_PASSWORD,
  },
] as const;

/** @deprecated Use DEV_TEST_USERS[0] */
export const DEV_TEST_USER = DEV_TEST_USERS[0];

export function isDevLoginShortcutsEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}
