export type ChatThemeId = 'solid-warm' | 'faux-fur-light';

export const CHAT_THEME_STORAGE_KEY = 'orbitchat-chat-theme';

export const CHAT_THEMES: ChatThemeId[] = ['solid-warm', 'faux-fur-light'];

export const DEFAULT_CHAT_THEME: ChatThemeId = 'solid-warm';

function parseChatThemeId(value: string | null): ChatThemeId | null {
  if (value === 'solid-warm' || value === 'faux-fur-light') {
    return value;
  }

  return null;
}

export function getStoredChatTheme(): ChatThemeId {
  if (typeof window === 'undefined') {
    return DEFAULT_CHAT_THEME;
  }

  return parseChatThemeId(window.localStorage.getItem(CHAT_THEME_STORAGE_KEY)) ?? DEFAULT_CHAT_THEME;
}

export function setStoredChatTheme(id: ChatThemeId): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CHAT_THEME_STORAGE_KEY, id);
}

export function applyChatTheme(id: ChatThemeId): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.chatTheme = id;
}
