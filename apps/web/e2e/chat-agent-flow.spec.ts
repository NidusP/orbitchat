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

async function startDirectChat(
  pageA: Page,
  pageB: Page,
  identityA: E2EIdentity,
  identityB: E2EIdentity
): Promise<void> {
  await openUserProfileFromSearch(pageA, identityB.username, identityB.displayName);
  await pageA.getByRole('button', { name: 'Message' }).click();
  await expect(pageA).toHaveURL(/\/messages\/[0-9a-f-]+$/);

  await pageB.goto('/messages');
  await expect(pageB.getByText(identityA.displayName)).toBeVisible({ timeout: 15_000 });
  await pageB.getByText(identityA.displayName).click();
  await expect(pageB).toHaveURL(/\/messages\/[0-9a-f-]+$/);
}

async function createGroupChat(
  pageA: Page,
  identityB: E2EIdentity,
  groupTitle: string
): Promise<void> {
  await pageA.goto('/messages/new-group');
  await pageA.getByPlaceholder('Weekend crew').fill(groupTitle);
  await pageA.getByPlaceholder('Search by username').fill(identityB.username);
  await pageA.getByRole('button', { name: 'Search' }).click();
  await expect(pageA.getByText(identityB.displayName)).toBeVisible({ timeout: 15_000 });
  await pageA.getByRole('button', { name: new RegExp(identityB.displayName) }).click();
  await expect(pageA.getByText(`Selected: ${identityB.displayName}`)).toBeVisible();
  await pageA.getByRole('button', { name: 'Create group' }).click();
  await expect(pageA).toHaveURL(/\/messages\/[0-9a-f-]+$/);
  await expect(pageA.getByRole('heading', { name: groupTitle })).toBeVisible();
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

    await startDirectChat(pageA, pageB, identityA, identityB);
    await expect(pageA.getByRole('heading', { name: identityB.displayName })).toBeVisible();

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

test('direct chat shows typing indicator for the other participant', async ({ browser }) => {
  const identityA = createUniqueIdentity('typing_a');
  const identityB = createUniqueIdentity('typing_b');

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await registerAndLandOnProfile(pageA, identityA);
    await registerAndLandOnProfile(pageB, identityB);
    await startDirectChat(pageA, pageB, identityA, identityB);
    await expect(pageA.getByRole('heading', { name: identityB.displayName })).toBeVisible();
    await expect(pageB.getByRole('heading', { name: identityA.displayName })).toBeVisible();
    await expect(pageA.getByTestId('chat-ws-connected')).toHaveText('yes', { timeout: 15_000 });
    await expect(pageB.getByTestId('chat-ws-connected')).toHaveText('yes', { timeout: 15_000 });

    const composerA = pageA.getByPlaceholder('Write a message…');
    await composerA.fill('still typing…');
    await expect(pageB.getByTestId('chat-typing-indicator')).toContainText(identityA.displayName, {
      timeout: 15_000,
    });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('group owner can rename the group and add a new member from settings', async ({ browser }) => {
  const identityA = createUniqueIdentity('grp_set_a');
  const identityB = createUniqueIdentity('grp_set_b');
  const identityC = createUniqueIdentity('grp_set_c');
  const groupTitle = `E2E Settings Group ${Date.now()}`;
  const renamedTitle = `Renamed ${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();

  try {
    await registerAndLandOnProfile(pageA, identityA);
    await registerAndLandOnProfile(pageB, identityB);
    await registerAndLandOnProfile(pageC, identityC);

    await createGroupChat(pageA, identityB, groupTitle);

    await pageA.getByRole('link', { name: 'Settings' }).click();
    await expect(pageA.getByRole('heading', { name: 'Group settings' })).toBeVisible();

    const nameSection = pageA.locator('section').filter({ hasText: 'Group name' });
    await nameSection.getByRole('textbox').fill(renamedTitle);
    await pageA.getByRole('button', { name: 'Save name' }).click();
    await expect(pageA.getByRole('link', { name: 'Back to chat' })).toBeVisible();

    const addSection = pageA.locator('section').filter({ hasText: 'Add members' });
    await addSection.getByPlaceholder('Search by username').fill(identityC.username);
    await addSection.getByRole('button', { name: 'Search' }).click();
    await expect(addSection.getByText(identityC.displayName)).toBeVisible({ timeout: 15_000 });
    await addSection.getByRole('button', { name: new RegExp(identityC.displayName) }).click();
    await expect(pageA.getByText(`Members (3)`)).toBeVisible({ timeout: 15_000 });

    await pageC.goto('/messages');
    await expect(pageC.getByText(renamedTitle)).toBeVisible({ timeout: 15_000 });

    await pageB.goto('/messages');
    await expect(pageB.getByText(renamedTitle)).toBeVisible({ timeout: 15_000 });
  } finally {
    await contextA.close();
    await contextB.close();
    await contextC.close();
  }
});

test('group owner cannot leave until ownership is transferred', async ({ browser }) => {
  const identityA = createUniqueIdentity('grp_owner_a');
  const identityB = createUniqueIdentity('grp_owner_b');
  const groupTitle = `E2E Owner Leave ${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await registerAndLandOnProfile(pageA, identityA);
    await registerAndLandOnProfile(pageB, identityB);
    await createGroupChat(pageA, identityB, groupTitle);

    await pageA.getByRole('link', { name: 'Settings' }).click();
    await expect(pageA.getByRole('heading', { name: 'Group settings' })).toBeVisible();
    await expect(pageA.getByRole('button', { name: 'Leave group' })).not.toBeVisible();
    await expect(
      pageA.getByText('Transfer ownership to another member before you can leave the group.')
    ).toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('group owner can remove a member from settings', async ({ browser }) => {
  const identityA = createUniqueIdentity('grp_kick_a');
  const identityB = createUniqueIdentity('grp_kick_b');
  const groupTitle = `E2E Kick Group ${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await registerAndLandOnProfile(pageA, identityA);
    await registerAndLandOnProfile(pageB, identityB);
    await createGroupChat(pageA, identityB, groupTitle);

    await pageA.getByRole('link', { name: 'Settings' }).click();
    const memberRow = pageA.locator('.conversation-list-item').filter({
      hasText: identityB.displayName,
    });
    await memberRow.getByRole('button', { name: 'Remove' }).click();
    await expect(pageA.getByText(`Members (1)`)).toBeVisible({ timeout: 15_000 });
    await expect(memberRow).not.toBeVisible();

    await pageB.goto('/messages');
    await expect(pageB.getByText(groupTitle)).not.toBeVisible({ timeout: 15_000 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('group owner can transfer ownership and then leave the group', async ({ browser }) => {
  const identityA = createUniqueIdentity('grp_xfer_a');
  const identityB = createUniqueIdentity('grp_xfer_b');
  const groupTitle = `E2E Transfer Group ${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await registerAndLandOnProfile(pageA, identityA);
    await registerAndLandOnProfile(pageB, identityB);
    await createGroupChat(pageA, identityB, groupTitle);

    await pageA.getByRole('link', { name: 'Settings' }).click();
    const memberRow = pageA.locator('.conversation-list-item').filter({
      hasText: identityB.displayName,
    });
    await memberRow.getByRole('button', { name: 'Transfer ownership' }).click();

    const ownerRow = pageA.locator('.conversation-list-item').filter({
      hasText: identityB.displayName,
    });
    await expect(ownerRow.getByText('Owner')).toBeVisible({ timeout: 15_000 });

    const selfRow = pageA.locator('.conversation-list-item').filter({ hasText: '(you)' });
    await expect(selfRow.getByText('Admin')).toBeVisible();

    await pageA.getByRole('button', { name: 'Leave group' }).click();
    await expect(pageA).toHaveURL('/messages', { timeout: 15_000 });
    await expect(pageA.getByText(groupTitle)).not.toBeVisible();

    await pageB.goto('/messages');
    await pageB.getByText(groupTitle).click();
    await pageB.getByRole('link', { name: 'Settings' }).click();
    await expect(pageB.getByText(`Members (1)`)).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByRole('button', { name: 'Leave group' })).not.toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('group member can leave from settings', async ({ browser }) => {
  const identityA = createUniqueIdentity('grp_leave_a');
  const identityB = createUniqueIdentity('grp_leave_b');
  const groupTitle = `E2E Leave Group ${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await registerAndLandOnProfile(pageA, identityA);
    await registerAndLandOnProfile(pageB, identityB);
    await createGroupChat(pageA, identityB, groupTitle);

    await pageB.goto('/messages');
    await pageB.getByText(groupTitle).click();
    await pageB.getByRole('link', { name: 'Settings' }).click();
    await pageB.getByRole('button', { name: 'Leave group' }).click();

    await expect(pageB).toHaveURL('/messages', { timeout: 15_000 });
    await expect(pageB.getByText(groupTitle)).not.toBeVisible();

    await pageA.getByRole('link', { name: 'Settings' }).click();
    await expect(pageA.getByText(`Members (1)`)).toBeVisible({ timeout: 15_000 });
    await expect(pageA.getByText(identityB.displayName)).not.toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('user can start tic-tac-toe and play a move via agent tools', async ({ page }) => {
  const identity = createUniqueIdentity('tictactoe_e2e');

  await registerAndLandOnProfile(page, identity);
  await page.goto('/ai');
  await page.getByRole('button', { name: 'New chat' }).click();

  const composer = page.getByPlaceholder('Ask 小轨 something…');
  await composer.fill('[e2e:tictactoe]');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.tic-tac-toe-board')).toBeVisible({ timeout: 15_000 });

  await composer.fill('[e2e:tictactoe:5]');
  await page.getByRole('button', { name: 'Send' }).click();
  const completedBoard = page.locator('.tic-tac-toe-board').filter({
    has: page.locator('.tic-tac-toe-cell-marked', { hasText: 'O' }),
  });
  await expect(completedBoard).toBeVisible({ timeout: 15_000 });
  await expect(
    completedBoard.locator('.tic-tac-toe-cell-marked').filter({ hasText: 'X' })
  ).toBeVisible();
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

test('user can join a group via invite link', async ({ browser }) => {
  const identityA = createUniqueIdentity('invite_a');
  const identityB = createUniqueIdentity('invite_b');
  const identityC = createUniqueIdentity('invite_c');
  const groupTitle = `E2E Invite Group ${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();

  try {
    await registerAndLandOnProfile(pageA, identityA);
    await registerAndLandOnProfile(pageB, identityB);
    await registerAndLandOnProfile(pageC, identityC);

    await createGroupChat(pageA, identityB, groupTitle);

    await pageA.getByRole('link', { name: 'Settings' }).click();
    await expect(pageA.getByRole('heading', { name: 'Group settings' })).toBeVisible();
    await pageA.getByRole('button', { name: 'Generate invite link' }).click();

    const inviteRow = pageA.locator('.conversation-list-item').filter({ hasText: '/invites/' });
    await expect(inviteRow).toBeVisible({ timeout: 15_000 });
    const inviteUrl = await inviteRow.locator('.conversation-list-title').textContent();
    expect(inviteUrl).toBeTruthy();

    const invitePath = new URL(inviteUrl!.trim()).pathname;
    await pageC.goto(invitePath);
    await expect(pageC.getByRole('heading', { name: 'Group invite' })).toBeVisible();
    await expect(pageC.getByText(groupTitle)).toBeVisible({ timeout: 15_000 });
    await pageC.getByRole('button', { name: 'Join group' }).click();

    await expect(pageC).toHaveURL(/\/messages\/[0-9a-f-]+$/, { timeout: 15_000 });
    await expect(pageC.getByRole('heading', { name: groupTitle })).toBeVisible();

    await pageA.getByRole('link', { name: 'Back to chat' }).click();
    await pageA.getByRole('link', { name: 'Settings' }).click();
    await expect(pageA.getByText(`Members (3)`)).toBeVisible({ timeout: 15_000 });
    await expect(pageA.getByText(identityC.displayName)).toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
    await contextC.close();
  }
});

test('two users can create a group chat and exchange messages', async ({ browser }) => {
  const identityA = createUniqueIdentity('group_a');
  const identityB = createUniqueIdentity('group_b');
  const groupTitle = `E2E Group ${Date.now()}`;
  const message = `E2E group hello ${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await registerAndLandOnProfile(pageA, identityA);
    await registerAndLandOnProfile(pageB, identityB);

    await createGroupChat(pageA, identityB, groupTitle);

    await pageB.goto('/messages');
    await expect(pageB.getByText(groupTitle)).toBeVisible({ timeout: 15_000 });
    await pageB.getByText(groupTitle).click();
    await expect(pageB.getByRole('heading', { name: groupTitle })).toBeVisible();

    await pageA.getByPlaceholder('Write a message…').fill(message);
    await pageA.getByRole('button', { name: 'Send' }).click();

    await expect(pageB.getByText(message)).toBeVisible({ timeout: 15_000 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('user can approve AI create_post tool call and see the post on feed', async ({ browser }) => {
  const identityA = createUniqueIdentity('agent_post_a');
  const identityB = createUniqueIdentity('agent_post_b');
  const postContent = `E2E AI post ${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await registerAndLandOnProfile(pageA, identityA);
    await registerAndLandOnProfile(pageB, identityB);

    await pageA.goto('/ai');
    await pageA.getByRole('button', { name: 'New chat' }).click();
    await expect(pageA.getByPlaceholder('Ask 小轨 something…')).toBeVisible();

    await pageA
      .getByPlaceholder('Ask 小轨 something…')
      .fill(`[e2e:create_post] ${postContent}`);
    await pageA.getByRole('button', { name: 'Send' }).click();

    const pendingCard = pageA.locator('.ai-tool-call-card').filter({
      hasText: `Create post: ${postContent}`,
    });
    await expect(pendingCard).toBeVisible({ timeout: 15_000 });
    await pendingCard.getByRole('button', { name: 'Approve' }).click();
    await expect(pageA.getByText('Post published successfully.')).toBeVisible({
      timeout: 15_000,
    });

    await pageA.goto('/feed');
    await expect(pageA.getByText(postContent)).toBeVisible({ timeout: 15_000 });

    await pageB.goto(`/users/${await getUserIdFromProfile(pageB, identityA.username)}`);
    await expect(pageB.getByText(postContent)).toBeVisible({ timeout: 15_000 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

async function getUserIdFromProfile(page: Page, username: string): Promise<string> {
  await page.goto('/search');
  await page.getByTestId('search-input').fill(username);
  await page.getByTestId('search-submit').click();
  const row = page.locator('.user-result-item').filter({ hasText: username });
  await expect(row).toBeVisible({ timeout: 15_000 });
  const href = await row.locator('a').first().getAttribute('href');
  if (!href) {
    throw new Error('Expected user profile link');
  }
  return href.replace('/users/', '');
}

async function openNewAiChat(page: Page): Promise<void> {
  await page.goto('/ai');
  await page.getByRole('button', { name: 'New chat' }).click();
  await expect(page.getByPlaceholder('Ask 小轨 something…')).toBeVisible({ timeout: 15_000 });
}

test('user can approve remember_fact and see memory on memories page', async ({ page }) => {
  const identity = createUniqueIdentity('agent_memory');
  const memoryContent = `Call me Orbit ${Date.now()}`;

  await registerAndLandOnProfile(page, identity);
  await openNewAiChat(page);

  const composer = page.getByPlaceholder('Ask 小轨 something…');
  await composer.fill(`[e2e:remember_fact] nickname:${memoryContent}`);
  await page.getByRole('button', { name: 'Send' }).click();

  const pendingCard = page.locator('.ai-tool-call-card').filter({
    hasText: `Remember nickname: ${memoryContent}`,
  });
  await expect(pendingCard).toBeVisible({ timeout: 15_000 });
  await expect(pendingCard.getByText('确认后小轨会在之后的对话中记住这条信息')).toBeVisible();
  await pendingCard.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Memory saved successfully.')).toBeVisible({ timeout: 15_000 });

  await page.goto('/ai/memories');
  await expect(page.getByRole('heading', { name: 'AI Memories' })).toBeVisible();
  await expect(page.getByText(memoryContent)).toBeVisible({ timeout: 15_000 });
});

test('user can add and delete a memory on memories page', async ({ page }) => {
  const identity = createUniqueIdentity('agent_memory_crud');
  const memoryContent = `Prefer short replies ${Date.now()}`;

  await registerAndLandOnProfile(page, identity);
  await page.goto('/ai/memories');
  await expect(page.getByRole('heading', { name: 'AI Memories' })).toBeVisible();

  await page.getByPlaceholder('e.g. Prefer short replies, or call me Orbit').fill(memoryContent);
  await page.getByRole('button', { name: 'Add memory' }).click();
  await expect(page.getByText(memoryContent)).toBeVisible({ timeout: 15_000 });

  const memoryItem = page.locator('.conversation-list-item').filter({ hasText: memoryContent });
  await memoryItem.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(memoryContent)).not.toBeVisible({ timeout: 15_000 });
});

test('user can list recent posts via agent tool prefix', async ({ page }) => {
  const identity = createUniqueIdentity('agent_my_posts');
  const postContent = `E2E recent post ${Date.now()}`;

  await registerAndLandOnProfile(page, identity);
  await openNewAiChat(page);

  await page
    .getByPlaceholder('Ask 小轨 something…')
    .fill(`[e2e:create_post] ${postContent}`);
  await page.getByRole('button', { name: 'Send' }).click();

  const createCard = page.locator('.ai-tool-call-card').filter({
    hasText: `Create post: ${postContent}`,
  });
  await expect(createCard).toBeVisible({ timeout: 15_000 });
  await createCard.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Post published successfully.')).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder('Ask 小轨 something…').fill('[e2e:my_posts]');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.chat-bubble-tool').filter({ hasText: /最近帖子/ })).toBeVisible({
    timeout: 15_000,
  });
});

test('user can run semantic post search tool via agent prefix', async ({ page }) => {
  const identity = createUniqueIdentity('agent_search_posts');

  await registerAndLandOnProfile(page, identity);
  await openNewAiChat(page);

  await page.getByPlaceholder('Ask 小轨 something…').fill('[e2e:search_posts] travel');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.chat-bubble-tool').filter({ hasText: /搜索你的帖子/ })).toBeVisible({
    timeout: 15_000,
  });
});

test('user can run help docs search tool via agent prefix', async ({ page }) => {
  const identity = createUniqueIdentity('agent_search_help');

  await registerAndLandOnProfile(page, identity);
  await openNewAiChat(page);

  await page.getByPlaceholder('Ask 小轨 something…').fill('[e2e:search_help] api');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.chat-bubble-tool').filter({ hasText: /搜索帮助文档/ })).toBeVisible({
    timeout: 15_000,
  });
});

test('user can load profile via agent tool prefix', async ({ page }) => {
  const identity = createUniqueIdentity('agent_my_profile');

  await registerAndLandOnProfile(page, identity);
  await openNewAiChat(page);

  await page.getByPlaceholder('Ask 小轨 something…').fill('[e2e:my_profile]');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(
    page.locator('.chat-bubble-tool').filter({ hasText: identity.username })
  ).toBeVisible({ timeout: 15_000 });
});

test('user can reject remember_fact pending tool call', async ({ page }) => {
  const identity = createUniqueIdentity('agent_memory_reject');
  const memoryContent = `Do not save ${Date.now()}`;

  await registerAndLandOnProfile(page, identity);
  await openNewAiChat(page);

  await page
    .getByPlaceholder('Ask 小轨 something…')
    .fill(`[e2e:remember_fact] nickname:${memoryContent}`);
  await page.getByRole('button', { name: 'Send' }).click();

  const pendingCard = page.locator('.ai-tool-call-card').filter({
    hasText: `Remember nickname: ${memoryContent}`,
  });
  await expect(pendingCard).toBeVisible({ timeout: 15_000 });
  await pendingCard.getByRole('button', { name: 'Reject' }).click();
  await expect(pendingCard).not.toBeVisible({ timeout: 15_000 });

  await page.goto('/ai/memories');
  await expect(page.getByText(memoryContent)).not.toBeVisible();
});

test('AI chat page links to memories management', async ({ page }) => {
  const identity = createUniqueIdentity('agent_memories_link');

  await registerAndLandOnProfile(page, identity);
  await page.goto('/ai');
  await page.getByRole('link', { name: '记忆管理' }).click();
  await expect(page).toHaveURL('/ai/memories');
  await expect(page.getByRole('heading', { name: 'AI Memories' })).toBeVisible();
});
