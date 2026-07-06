/** Shared dev test accounts — server scripts + web login shortcuts must stay in sync. */
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

/** @deprecated Use DEV_TEST_USERS[0] — kept for existing imports */
export const DEV_TEST_USER_EMAIL = DEV_TEST_USERS[0].email;
/** @deprecated Use DEV_TEST_USERS[0] — kept for existing imports */
export const DEV_TEST_USER_USERNAME = DEV_TEST_USERS[0].username;
