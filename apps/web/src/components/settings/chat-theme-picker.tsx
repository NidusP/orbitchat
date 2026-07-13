'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/contexts/i18n-context';
import {
  applyChatTheme,
  CHAT_THEMES,
  ChatThemeId,
  DEFAULT_CHAT_THEME,
  getStoredChatTheme,
  setStoredChatTheme,
} from '@/lib/chat-theme';

export function ChatThemePicker() {
  const { t } = useI18n();
  const [selectedTheme, setSelectedTheme] = useState<ChatThemeId>(DEFAULT_CHAT_THEME);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const storedTheme = getStoredChatTheme();
    setSelectedTheme(storedTheme);
    applyChatTheme(storedTheme);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  function handleThemeChange(themeId: ChatThemeId): void {
    setSelectedTheme(themeId);
    applyChatTheme(themeId);
    setStoredChatTheme(themeId);
    setSaveFeedback(t('chatTheme.saved'));

    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      setSaveFeedback(null);
      feedbackTimerRef.current = null;
    }, 1500);
  }

  return (
    <section>
      <h2 className="section-title">{t('chatTheme.title')}</h2>
      <p className="text-muted">{t('chatTheme.description')}</p>

      <fieldset style={{ border: 0, padding: 0, margin: '12px 0 0 0' }}>
        <legend className="text-muted" style={{ marginBottom: 8 }}>
          {t('chatTheme.legend')}
        </legend>

        <div style={{ display: 'grid', gap: 10 }}>
          {CHAT_THEMES.map((themeId) => {
            const isActive = selectedTheme === themeId;
            const label =
              themeId === 'solid-warm'
                ? t('chatTheme.options.solidWarm.label')
                : t('chatTheme.options.fauxFurLight.label');
            const description =
              themeId === 'solid-warm'
                ? t('chatTheme.options.solidWarm.description')
                : t('chatTheme.options.fauxFurLight.description');

            return (
              <label
                key={themeId}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  border: `1px solid ${isActive ? 'var(--warm-accent)' : 'var(--warm-border)'}`,
                  borderRadius: 'var(--warm-radius-md)',
                  padding: '12px 14px',
                  background: isActive ? 'var(--warm-accent-soft)' : 'var(--warm-bg-surface)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="chat-theme"
                  value={themeId}
                  checked={isActive}
                  onChange={() => handleThemeChange(themeId)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <strong>{label}</strong>
                  <span className="text-muted" style={{ display: 'block', marginTop: 2 }}>
                    {description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="text-muted" role="status" aria-live="polite" style={{ minHeight: 20, marginTop: 10 }}>
        {saveFeedback}
      </p>
    </section>
  );
}
