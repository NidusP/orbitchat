'use client';

import { useEffect, useRef, useState } from 'react';
import {
  applyChatTheme,
  CHAT_THEMES,
  ChatThemeId,
  DEFAULT_CHAT_THEME,
  getStoredChatTheme,
  setStoredChatTheme,
} from '@/lib/chat-theme';

export function ChatThemePicker() {
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
    setSaveFeedback('已保存');

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
      <h2 className="section-title">聊天主题</h2>
      <p className="text-muted">切换后会立即生效，无需刷新页面。</p>

      <fieldset style={{ border: 0, padding: 0, margin: '12px 0 0 0' }}>
        <legend className="text-muted" style={{ marginBottom: 8 }}>
          选择聊天背景风格
        </legend>

        <div style={{ display: 'grid', gap: 10 }}>
          {CHAT_THEMES.map((theme) => {
            const isActive = selectedTheme === theme.id;

            return (
              <label
                key={theme.id}
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
                  value={theme.id}
                  checked={isActive}
                  onChange={() => handleThemeChange(theme.id)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <strong>{theme.label}</strong>
                  <span className="text-muted" style={{ display: 'block', marginTop: 2 }}>
                    {theme.description}
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
