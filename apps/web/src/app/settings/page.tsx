import Link from 'next/link';
import { ChatThemePicker } from '@/components/settings/chat-theme-picker';

export default function SettingsHubPage() {
  return (
    <main className="main-wide">
      <header className="page-header">
        <h1>设置</h1>
        <p>统一管理账号安全与小轨能力。</p>
      </header>

      <div className="card">
        <h2 className="section-title">账号与安全</h2>
        <p className="text-muted">查看当前设备与历史会话，保护你的账号安全。</p>
        <Link href="/settings/sessions" className="btn btn-primary">
          管理会话
        </Link>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="section-title">小轨记忆</h2>
        <p className="text-muted">查看与管理 AI 记忆条目，帮助小轨更懂你。</p>
        <Link href="/ai/memories" className="btn btn-primary">
          打开记忆
        </Link>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <ChatThemePicker />
      </div>
    </main>
  );
}
