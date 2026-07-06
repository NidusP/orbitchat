import { expect, test, type Page } from '@playwright/test';

interface E2EIdentity {
  username: string;
  email: string;
  displayName: string;
}

function createUniqueIdentity(prefix: string): E2EIdentity {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

  return {
    username: `${prefix}_${suffix}`.slice(0, 32),
    email: `${prefix}-${suffix}@example.com`,
    displayName: `${prefix} ${suffix}`,
  };
}

async function registerAndLandOnProfile(page: Page, identity: E2EIdentity): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Username').fill(identity.username);
  await page.getByLabel('Display name').fill(identity.displayName);
  await page.getByLabel('Email').fill(identity.email);
  await page.getByLabel('Password').fill('Password123!');
  await page.getByLabel('Trust this device').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/profile');
}

async function openUserProfileFromSearch(
  page: Page,
  username: string,
  displayName?: string
): Promise<void> {
  await page.goto('/search');
  await page.getByTestId('search-input').fill(username);
  await page.getByTestId('search-submit').click();

  if (displayName) {
    await expect(page.getByText(displayName)).toBeVisible({ timeout: 15_000 });
  }

  const row = page.locator('.user-result-item').filter({ hasText: username });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.locator('a').first().click();
  await expect(page).toHaveURL(/\/users\/[0-9a-f-]+$/);
}

test('two users can start a direct chat and receive messages', async ({ browser }) => {
  const identityA = createUniqueIdentity('chat_a');
  const identityB = createUniqueIdentity('chat_b');
  const message = `E2E private hello ${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await registerAndLandOnProfile(pageA, identityA);
    await registerAndLandOnProfile(pageB, identityB);

    await openUserProfileFromSearch(pageA, identityB.username, identityB.displayName);
    await pageA.getByRole('button', { name: 'Message' }).click();
    await expect(pageA).toHaveURL(/\/messages\/[0-9a-f-]+$/);
    await expect(pageA.getByRole('heading', { name: identityB.displayName })).toBeVisible();

    await pageB.goto('/messages');
    await expect(pageB.getByRole('heading', { name: 'Messages' })).toBeVisible();
    await expect(pageB.getByText(identityA.displayName)).toBeVisible();

    await pageA.getByPlaceholder('Write a message…').fill(message);
    await pageA.getByRole('button', { name: 'Send' }).click();

    await expect(pageB.getByText(message)).toBeVisible({ timeout: 15_000 });
    await pageB.getByText(identityA.displayName).click();
    await expect(pageB.getByText(message)).toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('user can open AI chat and create a conversation without running a model', async ({ page }) => {
  const identity = createUniqueIdentity('agent_e2e');

  await registerAndLandOnProfile(page, identity);
  await page.goto('/ai');

  await expect(page.getByRole('heading', { name: 'AI Chat' })).toBeVisible();
  const agentSelect = page.getByRole('combobox');
  await expect(agentSelect).toBeVisible();
  await expect(agentSelect.locator('option', { hasText: '小轨' })).toHaveCount(1);
  await expect(page.locator('.ai-agent-summary strong')).toHaveText('小轨');

  const newChatButton = page.getByRole('button', { name: 'New chat' });
  await expect(newChatButton).toBeEnabled({ timeout: 10_000 });
  await newChatButton.click();

  await expect(page.locator('.ai-conversation-button').filter({ hasText: '小轨 chat' })).toBeVisible();
  await expect(page.getByPlaceholder('Ask 小轨 something…')).toBeVisible();
});
