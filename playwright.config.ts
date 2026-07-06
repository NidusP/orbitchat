import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 3100;
const API_PORT = 3101;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const API_URL = `http://127.0.0.1:${API_PORT}`;

export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: [
    {
      command: 'pnpm --dir apps/server start',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        PORT: String(API_PORT),
        CORS_ORIGIN: WEB_URL,
      },
    },
    {
      command: 'pnpm --dir apps/web build && pnpm --dir apps/web start',
      url: `${WEB_URL}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...process.env,
        PORT: String(WEB_PORT),
        NEXT_PUBLIC_API_URL: API_URL,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
  ],
});
