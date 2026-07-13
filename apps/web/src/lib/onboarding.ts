export const ONBOARDING_STORAGE_KEY = 'orbitchat-onboarding-complete-v1';

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
}

export function markOnboardingComplete(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
}
