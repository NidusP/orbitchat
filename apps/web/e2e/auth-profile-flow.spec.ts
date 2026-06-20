import { expect, test } from '@playwright/test';

function createUniqueIdentity(): {
  username: string;
  email: string;
  displayName: string;
  updatedDisplayName: string;
  updatedUsername: string;
  bio: string;
} {
  const usernameSuffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const emailSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    username: `orbit_e2e_${usernameSuffix}`.slice(0, 32),
    email: `orbit-e2e-${emailSuffix}@example.com`,
    displayName: `Orbit E2E ${usernameSuffix}`,
    updatedDisplayName: `Orbit Updated ${usernameSuffix}`.slice(0, 128),
    updatedUsername: `orbit_up_${usernameSuffix}`.slice(0, 32),
    bio: `Updated from Playwright ${usernameSuffix}`,
  };
}

async function registerAndLandOnProfile(
  page: import('@playwright/test').Page,
  identity: ReturnType<typeof createUniqueIdentity>
): Promise<void> {
  await page.goto('/register');

  await page.getByLabel('Username').fill(identity.username);
  await page.getByLabel('Display name').fill(identity.displayName);
  await page.getByLabel('Email').fill(identity.email);
  await page.getByLabel('Password').fill('Password123!');
  await page.getByLabel('Trust this device').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL('/profile');
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
}

test('user can register, auto-login, edit profile, and logout', async ({ page }) => {
  const identity = createUniqueIdentity();

  await registerAndLandOnProfile(page, identity);

  await expect(page.getByLabel('Username')).toHaveValue(identity.username);
  await expect(page.getByLabel('Email')).toHaveValue(identity.email);

  await page.getByLabel('Display name').fill(identity.updatedDisplayName);
  await page.getByLabel('Bio').fill(identity.bio);
  await page.getByRole('button', { name: 'Save profile' }).click();

  await expect(page.getByText('Profile updated.')).toBeVisible();
  await expect(page.getByLabel('Display name')).toHaveValue(identity.updatedDisplayName);
  await expect(page.getByLabel('Bio')).toHaveValue(identity.bio);

  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
});

test('unauthenticated users are redirected to login from profile', async ({ page }) => {
  await page.goto('/profile');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});

test('unauthenticated users are redirected to login from sessions', async ({ page }) => {
  await page.goto('/settings/sessions');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});

test('login shows an error for invalid credentials', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Email').fill('missing-user@example.com');
  await page.getByLabel('Password').fill('WrongPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Invalid credentials')).toBeVisible();
});

test('register rejects weak passwords before submit', async ({ page }) => {
  await page.goto('/register');

  await page.getByLabel('Username').fill('orbit_weak_pw');
  await page.getByLabel('Display name').fill('Weak Password Test');
  await page.getByLabel('Email').fill('weak-password@example.com');
  await page.getByLabel('Password').fill('short');

  const validity = await page.getByLabel('Password').evaluate((input) => {
    return input instanceof HTMLInputElement ? input.validity.valid : false;
  });

  expect(validity).toBe(false);
});

test('user can edit account fields on profile', async ({ page }) => {
  const identity = createUniqueIdentity();

  await registerAndLandOnProfile(page, identity);

  await page.getByLabel('Username').fill(identity.updatedUsername);
  await page.getByRole('button', { name: 'Save account' }).click();

  await expect(page.getByText('Account updated.')).toBeVisible();
  await expect(page.getByLabel('Username')).toHaveValue(identity.updatedUsername);

  await page.reload();
  await expect(page.getByLabel('Username')).toHaveValue(identity.updatedUsername);
});

test('trusted user can view sessions and sign out this device', async ({ page }) => {
  const identity = createUniqueIdentity();

  await registerAndLandOnProfile(page, identity);

  await page.goto('/settings/sessions');
  await expect(page.getByRole('heading', { name: 'Sessions', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'This device' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'All sessions' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out this device' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
