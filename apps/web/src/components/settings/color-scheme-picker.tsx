'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/contexts/i18n-context';
import {
  applyColorScheme,
  ColorScheme,
  DEFAULT_COLOR_SCHEME,
  getStoredColorScheme,
  setStoredColorScheme,
} from '@/lib/app-theme';

interface ColorSchemeOption {
  value: ColorScheme;
  label: string;
  description: string;
}

export function ColorSchemePicker() {
  const { t } = useI18n();
  const colorSchemeOptions: ColorSchemeOption[] = [
    {
      value: 'light',
      label: t('appearance.options.light.label'),
      description: t('appearance.options.light.description'),
    },
    {
      value: 'dark',
      label: t('appearance.options.dark.label'),
      description: t('appearance.options.dark.description'),
    },
    {
      value: 'system',
      label: t('appearance.options.system.label'),
      description: t('appearance.options.system.description'),
    },
  ];
  const [selectedScheme, setSelectedScheme] = useState<ColorScheme>(DEFAULT_COLOR_SCHEME);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const storedScheme = getStoredColorScheme();
    setSelectedScheme(storedScheme);
    applyColorScheme(storedScheme);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  function handleSchemeChange(scheme: ColorScheme): void {
    setSelectedScheme(scheme);
    applyColorScheme(scheme);
    setStoredColorScheme(scheme);
    setSaveFeedback(t('appearance.saved'));

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
      <h2 className="section-title">{t('appearance.title')}</h2>
      <p className="text-muted">{t('appearance.description')}</p>

      <fieldset style={{ border: 0, padding: 0, margin: '12px 0 0 0' }}>
        <legend className="text-muted" style={{ marginBottom: 8 }}>
          {t('appearance.legend')}
        </legend>

        <div style={{ display: 'grid', gap: 10 }}>
          {colorSchemeOptions.map((option) => {
            const isActive = selectedScheme === option.value;

            return (
              <label
                key={option.value}
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
                  name="color-scheme"
                  value={option.value}
                  checked={isActive}
                  onChange={() => handleSchemeChange(option.value)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <strong>{option.label}</strong>
                  <span className="text-muted" style={{ display: 'block', marginTop: 2 }}>
                    {option.description}
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
