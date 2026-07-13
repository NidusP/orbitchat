'use client';

import Link from 'next/link';
import { ColorSchemePicker } from '@/components/settings/color-scheme-picker';
import { ChatThemePicker } from '@/components/settings/chat-theme-picker';
import { LocalePicker } from '@/components/settings/locale-picker';
import { useI18n } from '@/contexts/i18n-context';

export default function SettingsHubPage() {
  const { t } = useI18n();

  return (
    <main className="main-wide">
      <header className="page-header">
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.description')}</p>
      </header>

      <div className="card">
        <h2 className="section-title">{t('settings.accountSecurityTitle')}</h2>
        <p className="text-muted">{t('settings.accountSecurityDescription')}</p>
        <Link href="/settings/sessions" className="btn btn-primary">
          {t('settings.manageSessions')}
        </Link>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="section-title">{t('settings.memoryTitle')}</h2>
        <p className="text-muted">{t('settings.memoryDescription')}</p>
        <Link href="/ai/memories" className="btn btn-primary">
          {t('settings.openMemory')}
        </Link>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <LocalePicker />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <ColorSchemePicker />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <ChatThemePicker />
      </div>
    </main>
  );
}
