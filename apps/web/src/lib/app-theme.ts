export type ColorScheme = 'light' | 'dark' | 'system';

type ResolvedColorScheme = Exclude<ColorScheme, 'system'>;

export const COLOR_SCHEME_STORAGE_KEY = 'orbitchat-color-scheme';
export const DEFAULT_COLOR_SCHEME: ColorScheme = 'system';

let activeColorScheme: ColorScheme = DEFAULT_COLOR_SCHEME;
let removeSystemListener: (() => void) | null = null;

function parseColorScheme(value: string | null): ColorScheme | null {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }

  return null;
}

function resolveSystemColorScheme(): ResolvedColorScheme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setDocumentColorScheme(scheme: ResolvedColorScheme): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.colorScheme = scheme;
}

function handleSystemPreferenceChange(): void {
  if (activeColorScheme !== 'system') {
    return;
  }

  setDocumentColorScheme(resolveSystemColorScheme());
}

function stopListeningSystemPreference(): void {
  if (removeSystemListener === null) {
    return;
  }

  removeSystemListener();
  removeSystemListener = null;
}

function listenSystemPreference(): void {
  if (typeof window === 'undefined') {
    return;
  }

  stopListeningSystemPreference();
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => {
    handleSystemPreferenceChange();
  };

  mediaQuery.addEventListener('change', listener);
  removeSystemListener = () => {
    mediaQuery.removeEventListener('change', listener);
  };
}

export function getStoredColorScheme(): ColorScheme {
  if (typeof window === 'undefined') {
    return DEFAULT_COLOR_SCHEME;
  }

  return parseColorScheme(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)) ?? DEFAULT_COLOR_SCHEME;
}

export function setStoredColorScheme(scheme: ColorScheme): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme);
}

export function applyColorScheme(scheme: ColorScheme): void {
  activeColorScheme = scheme;

  if (scheme === 'system') {
    setDocumentColorScheme(resolveSystemColorScheme());
    listenSystemPreference();
    return;
  }

  stopListeningSystemPreference();
  setDocumentColorScheme(scheme);
}
