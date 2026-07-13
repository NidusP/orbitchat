'use client';

import type { Locale } from '@/lib/i18n';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n';
import { useI18n } from '@/contexts/i18n-context';

const LOCALE_OPTIONS: Locale[] = ['zh', 'en'];

export function LocalePicker() {
  const { locale, setLocale, t } = useI18n();

  function handleLocaleChange(nextLocale: Locale): void {
    setLocale(nextLocale);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = nextLocale;
    }
  }

  return (
    <section>
      <h2 className="section-title">{t('settings.localeTitle')}</h2>
      <p className="text-muted">{t('settings.localeDescription')}</p>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {LOCALE_OPTIONS.map((option) => {
          const isActive = locale === option;
          const label = option === 'zh' ? t('settings.localeZh') : t('settings.localeEn');

          return (
            <button
              key={option}
              type="button"
              className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleLocaleChange(option)}
              aria-pressed={isActive}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
