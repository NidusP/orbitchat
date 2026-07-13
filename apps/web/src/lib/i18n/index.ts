import { enMessages } from './messages/en';
import { zhMessages, type I18nMessages } from './messages/zh';
import type { Locale, MessageValues } from './types';

export const DEFAULT_LOCALE: Locale = 'zh';
export const LOCALE_STORAGE_KEY = 'orbitchat.locale';

const messagesByLocale: Record<Locale, I18nMessages> = {
  zh: zhMessages,
  en: enMessages,
};

type JoinPath<K extends string, P extends string> = `${K}.${P}`;

export type DotPath<T extends Record<string, unknown>> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? JoinPath<K, DotPath<T[K]>>
    : K;
}[keyof T & string];

export type I18nKey = DotPath<I18nMessages>;

export function getMessage(locale: Locale, key: I18nKey): string {
  const fallback = lookupMessage(messagesByLocale[DEFAULT_LOCALE], key);
  const resolved = lookupMessage(messagesByLocale[locale], key);

  return resolved ?? fallback ?? key;
}

export function resolveLocale(input: string | null | undefined): Locale {
  if (!input) {
    return DEFAULT_LOCALE;
  }

  const normalized = input.toLowerCase();
  if (normalized.startsWith('en')) {
    return 'en';
  }
  if (normalized.startsWith('zh')) {
    return 'zh';
  }
  return DEFAULT_LOCALE;
}

export function getPreferredLocale(): Locale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) {
    return resolveLocale(stored);
  }

  return resolveLocale(window.navigator.language);
}

export function persistLocale(locale: Locale): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

function formatMessage(template: string, values?: MessageValues): string {
  if (!values) {
    return template;
  }

  return Object.entries(values).reduce(
    (current, [entryKey, value]) => current.split(`{${entryKey}}`).join(String(value)),
    template
  );
}

export function translate(locale: Locale, key: I18nKey, values?: MessageValues): string {
  return formatMessage(getMessage(locale, key), values);
}

function lookupMessage(messages: I18nMessages, key: string): string | undefined {
  const segments = key.split('.');
  let current: unknown = messages;

  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }

  return typeof current === 'string' ? current : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export { DEFAULT_LOCALE as FALLBACK_LOCALE };
export type { Locale, MessageValues };
