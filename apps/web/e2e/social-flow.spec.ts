import { expect, test, type Page } from '@playwright/test';

interface E2EIdentity {
  username: string;
  email: string;
  displayName: string;
}

function createUniqueIdentity(): E2EIdentity {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

  return {
    username: `orbit_e2e_${suffix}`.slice(0, 32),
    email: `orbit-e2e-${suffix}@example.com`,
    displayName: `Orbit E2E ${suffix}`,
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

async function publishPost(page: Page, content: string): Promise<void> {
  await page.goto('/feed');
  await expect(page.getByRole('heading', { name: 'Home feed' })).toBeVisible();
  await page.getByTestId('post-composer-content').fill(content);
  await page.getByTestId('post-composer-submit').click();
  await expect(page.getByText(content)).toBeVisible();
}

test('user can publish a post and see it on the home feed', async ({ page }) => {
  const identity = createUniqueIdentity();
  const postContent = `E2E solo post ${Date.now()}`;

  await registerAndLandOnProfile(page, identity);
  await publishPost(page, postContent);

  await expect(page.getByTestId('post-composer-content')).toHaveValue('');
});

test('user can like a post on the feed', async ({ page }) => {
  const identity = createUniqueIdentity();
  const postContent = `E2E like post ${Date.now()}`;

  await registerAndLandOnProfile(page, identity);
  await publishPost(page, postContent);

  const post = page.locator('[data-testid^="feed-post-"]').filter({ hasText: postContent }).first();
  const likeButton = post.getByTestId(/^post-like-/);

  await expect(likeButton).toContainText('♡ Like');
  await likeButton.click();
  await expect(likeButton).toContainText('♥ Liked');
  await expect(likeButton).toContainText('(1)');
});

test('followed user post appears on follower feed', async ({ browser }) => {
  const identityA = createUniqueIdentity();
  const identityB = createUniqueIdentity();
  const postContent = `E2E follow feed ${Date.now()}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await registerAndLandOnProfile(pageA, identityA);
    await publishPost(pageA, postContent);

    await registerAndLandOnProfile(pageB, identityB);

    await pageB.goto('/search');
    await pageB.getByTestId('search-input').fill(identityA.username);
    await pageB.getByTestId('search-submit').click();
    await expect(pageB.getByText(identityA.displayName)).toBeVisible();

    const authorRow = pageB.locator('.user-result-item').filter({ hasText: identityA.username });
    await authorRow.getByRole('button', { name: 'Follow' }).click();
    await expect(authorRow.getByRole('button', { name: 'Following' })).toBeVisible();

    await pageB.goto('/feed');
    await expect(pageB.getByText(postContent)).toBeVisible({ timeout: 15_000 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('user can comment on a post', async ({ page }) => {
  const identity = createUniqueIdentity();
  const postContent = `E2E comment post ${Date.now()}`;
  const commentText = `Nice post ${Date.now()}`;

  await registerAndLandOnProfile(page, identity);
  await publishPost(page, postContent);

  const post = page.locator('[data-testid^="feed-post-"]').filter({ hasText: postContent }).first();
  const postId = await post.getAttribute('data-testid');
  expect(postId).toBeTruthy();

  const postKey = postId!.replace('feed-post-', '');

  await post.getByTestId(`post-comments-toggle-${postKey}`).click();
  await expect(page.getByTestId(`post-comments-panel-${postKey}`)).toBeVisible();

  await page.getByTestId(`comment-input-${postKey}`).fill(commentText);
  await page.getByTestId(`comment-submit-${postKey}`).click();

  await expect(page.getByText(commentText)).toBeVisible();
  await expect(post.getByTestId(`post-comments-toggle-${postKey}`)).toContainText('(1)');
});

test('unauthenticated users are redirected from feed', async ({ page }) => {
  await page.goto('/feed');
  await expect(page).toHaveURL(/\/login$/);
});
