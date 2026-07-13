import type { Browser, BrowserContext, Page } from '@playwright/test';

export const E2E_LOCALE_STORAGE_KEY = 'orbitchat.locale';
export const E2E_ONBOARDING_STORAGE_KEY = 'orbitchat-onboarding-complete-v1';
export const E2E_LOCALE = 'en';

const localeInitPayload = {
  localeKey: E2E_LOCALE_STORAGE_KEY,
  localeValue: E2E_LOCALE,
  onboardingKey: E2E_ONBOARDING_STORAGE_KEY,
};

async function installLocaleInitScript(
  target: Pick<BrowserContext, 'addInitScript'>
): Promise<void> {
  await target.addInitScript(
    ({ localeKey, localeValue, onboardingKey }) => {
      window.localStorage.setItem(localeKey, localeValue);
      window.localStorage.setItem(onboardingKey, '1');
    },
    localeInitPayload
  );
}

export async function prepareEnglishLocale(page: Page): Promise<void> {
  await installLocaleInitScript(page.context());
}

export async function createEnglishContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  await installLocaleInitScript(context);
  return context;
}
