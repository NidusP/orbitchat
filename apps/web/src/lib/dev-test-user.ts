/** Local dev fixture — keep in sync with apps/server/src/lib/dev-test-user.ts */
export const DEV_TEST_USER_EMAIL = 'test@test.com';
export const DEV_TEST_USER_USERNAME = 'test_popolus';
export const DEV_TEST_USER_PASSWORD = 'Password123!';

export const DEV_TEST_USER = {
  email: DEV_TEST_USER_EMAIL,
  username: DEV_TEST_USER_USERNAME,
  password: DEV_TEST_USER_PASSWORD,
} as const;

export function isDevLoginShortcutsEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}
