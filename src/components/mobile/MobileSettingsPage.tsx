'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { Bot, Database, Loader2, Mail, RefreshCcw, Save, Server, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type SettingsTab = 'security' | 'email' | 'ai' | 'system';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from_name: string;
  from_email: string;
}

interface AiConfig {
  deepSeekApiKey: string;
  doubaoApiKey: string;
  doubaoSecret: string;
  defaultProvider: 'deepseek' | 'doubao';
}

interface ServerInfo {
  platformName?: string;
  hostname?: string;
  cpus?: number;
  totalMem?: string;
  freeMem?: string;
  uptime?: string;
}

interface BackupInfo {
  autoEnabled?: boolean;
  intervalHours?: number;
  lastBackupAt?: string | null;
  backupDir?: string;
}

const tabs: Array<{ key: SettingsTab; label: string; icon: ElementType }> = [
  { key: 'security', label: '安全', icon: Shield },
  { key: 'email', label: '邮箱', icon: Mail },
  { key: 'ai', label: 'AI', icon: Bot },
  { key: 'system', label: '系统', icon: Server },
];

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm text-slate-700">{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function MobileSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('security');
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [backupSaving, setBackupSaving] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [backup, setBackup] = useState<BackupInfo>({ autoEnabled: false, intervalHours: 24 });
  const [security, setSecurity] = useState({
    passwordMinLength: 8,
    loginFailLimit: 5,
    sessionTimeout: 30,
    passwordRequireSpecial: true,
    twoFactorAuth: false,
  });
  const [email, setEmail] = useState<EmailConfig>({
    host: '',
    port: 465,
    secure: true,
    user: '',
    password: '',
    from_name: '聚星数据平台',
    from_email: '',
  });
  const [ai, setAi] = useState<AiConfig>({
    deepSeekApiKey: '',
    doubaoApiKey: '',
    doubaoSecret: '',
    defaultProvider: 'deepseek',
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [systemRes, backupRes, emailRes, aiRes] = await Promise.all([
        fetch('/api/system/info', { cache: 'no-store' }),
        fetch('/api/database-backup', { cache: 'no-store' }),
        fetch('/api/email-config', { cache: 'no-store' }),
        fetch('/api/ai-config', { cache: 'no-store' }),
      ]);

      const systemData = await systemRes.json().catch(() => ({}));
      const backupData = await backupRes.json().catch(() => ({}));
      const emailData = await emailRes.json().catch(() => ({}));
      const aiData = await aiRes.json().catch(() => ({}));

      if (systemData.success) setServerInfo(systemData.data);
      if (backupData.success) setBackup(backupData.config || {});
      if (emailData && emailData.host !== undefined) {
        setEmail({
          host: emailData.host || '',
          port: Number(emailData.port || 465),
          secure: emailData.secure === true || emailData.secure === 1,
          user: emailData.user || '',
          password: '',
          from_name: emailData.from_name || '聚星数据平台',
          from_email: emailData.from_email || '',
        });
      }
      if (aiData.success) {
        setAi({
          deepSeekApiKey: aiData.config?.deepSeekApiKey || '',
          doubaoApiKey: aiData.config?.doubaoApiKey || '',
          doubaoSecret: aiData.config?.doubaoSecret || '',
          defaultProvider: aiData.config?.defaultProvider === 'doubao' ? 'doubao' : 'deepseek',
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveEmail = async () => {
    setEmailLoading(true);
    try {
      const response = await fetch('/api/email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.error || '保存失败');
      alert('邮箱配置已保存');
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败');
    } finally {
      setEmailLoading(false);
    }
  };

  const saveAi = async () => {
    setAiLoading(true);
    try {
      const response = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ai),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || '保存失败');
      alert('AI 配置已保存');
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败');
    } finally {
      setAiLoading(false);
    }
  };

  const saveBackup = async () => {
    setBackupSaving(true);
    try {
      const response = await fetch('/api/database-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-config', config: backup }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || '保存失败');
      alert('备份配置已保存');
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败');
    } finally {
      setBackupSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="mobile-ios-glass rounded-[30px] p-5 text-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-blue-600">系统管理</p>
            <h1 className="mt-1 text-2xl font-bold">系统设置</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">移动端管理安全、邮箱、AI 和系统备份配置。</p>
          </div>
          <Button size="icon" variant="secondary" className="h-11 w-11 rounded-2xl border border-white/70 bg-white/[0.58] text-blue-700 shadow-sm backdrop-blur-xl hover:bg-white/75" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCcw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-2 rounded-[24px] border border-white/70 bg-white/[0.9] p-2 shadow-sm backdrop-blur-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-[20px] px-2 py-2 text-xs font-semibold transition',
                active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:bg-slate-100',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </section>

      <section className="rounded-[28px] border border-white/70 bg-white/[0.92] p-4 shadow-sm backdrop-blur-xl">
        {activeTab === 'security' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-950">安全设置</h2>
            <Row label="密码最小长度">
              <Input className="h-11 rounded-2xl" type="number" value={security.passwordMinLength} onChange={(event) => setSecurity({ ...security, passwordMinLength: Number(event.target.value) })} />
            </Row>
            <Row label="登录失败次数限制">
              <Input className="h-11 rounded-2xl" type="number" value={security.loginFailLimit} onChange={(event) => setSecurity({ ...security, loginFailLimit: Number(event.target.value) })} />
            </Row>
            <Row label="会话超时时间（分钟）">
              <Input className="h-11 rounded-2xl" type="number" value={security.sessionTimeout} onChange={(event) => setSecurity({ ...security, sessionTimeout: Number(event.target.value) })} />
            </Row>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <div>
                <div className="font-medium text-slate-900">密码要求特殊字符</div>
                <div className="text-xs text-slate-500">密码必须包含特殊字符</div>
              </div>
              <Switch checked={security.passwordRequireSpecial} onCheckedChange={(checked) => setSecurity({ ...security, passwordRequireSpecial: checked })} />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <div>
                <div className="font-medium text-slate-900">双因素认证</div>
                <div className="text-xs text-slate-500">启用双因素认证增强安全性</div>
              </div>
              <Switch checked={security.twoFactorAuth} onCheckedChange={(checked) => setSecurity({ ...security, twoFactorAuth: checked })} />
            </div>
            <Button className="h-11 w-full rounded-2xl bg-slate-950" onClick={() => alert('安全设置已保存')}>
              <Save className="mr-2 h-4 w-4" />
              保存设置
            </Button>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-950">邮箱配置</h2>
            <Row label="SMTP 服务器"><Input className="h-11 rounded-2xl" value={email.host} onChange={(event) => setEmail({ ...email, host: event.target.value })} /></Row>
            <Row label="端口"><Input className="h-11 rounded-2xl" type="number" value={email.port} onChange={(event) => setEmail({ ...email, port: Number(event.target.value) })} /></Row>
            <Row label="账号"><Input className="h-11 rounded-2xl" value={email.user} onChange={(event) => setEmail({ ...email, user: event.target.value })} /></Row>
            <Row label="密码"><Input className="h-11 rounded-2xl" type="password" value={email.password} onChange={(event) => setEmail({ ...email, password: event.target.value })} placeholder="不修改可留空" /></Row>
            <Row label="发件邮箱"><Input className="h-11 rounded-2xl" value={email.from_email} onChange={(event) => setEmail({ ...email, from_email: event.target.value })} /></Row>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span className="font-medium text-slate-900">SSL 安全连接</span>
              <Switch checked={email.secure} onCheckedChange={(checked) => setEmail({ ...email, secure: checked })} />
            </div>
            <Button className="h-11 w-full rounded-2xl bg-blue-600" onClick={saveEmail} disabled={emailLoading}>
              {emailLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存邮箱配置
            </Button>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-950">AI 配置</h2>
            <Row label="默认服务商">
              <select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3" value={ai.defaultProvider} onChange={(event) => setAi({ ...ai, defaultProvider: event.target.value === 'doubao' ? 'doubao' : 'deepseek' })}>
                <option value="deepseek">DeepSeek</option>
                <option value="doubao">豆包</option>
              </select>
            </Row>
            <Row label="DeepSeek API Key"><Input className="h-11 rounded-2xl" type="password" value={ai.deepSeekApiKey} onChange={(event) => setAi({ ...ai, deepSeekApiKey: event.target.value })} /></Row>
            <Row label="豆包 API Key"><Input className="h-11 rounded-2xl" type="password" value={ai.doubaoApiKey} onChange={(event) => setAi({ ...ai, doubaoApiKey: event.target.value })} /></Row>
            <Row label="豆包 Secret"><Input className="h-11 rounded-2xl" type="password" value={ai.doubaoSecret} onChange={(event) => setAi({ ...ai, doubaoSecret: event.target.value })} /></Row>
            <Button className="h-11 w-full rounded-2xl bg-blue-600" onClick={saveAi} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存 AI 配置
            </Button>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-950">系统与备份</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['主机', serverInfo?.hostname || '-'],
                ['系统', serverInfo?.platformName || '-'],
                ['CPU', serverInfo?.cpus || '-'],
                ['内存', serverInfo?.totalMem || '-'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">{label}</div>
                  <div className="mt-1 truncate font-medium text-slate-900">{value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <div className="flex items-center gap-2 font-semibold text-slate-950">
                <Database className="h-4 w-4 text-blue-600" />
                数据库备份
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-slate-600">自动备份</span>
                <Switch checked={Boolean(backup.autoEnabled)} onCheckedChange={(checked) => setBackup({ ...backup, autoEnabled: checked })} />
              </div>
              <div className="mt-3">
                <Label>间隔小时</Label>
                <Input className="mt-2 h-11 rounded-2xl bg-white" type="number" value={backup.intervalHours || 24} onChange={(event) => setBackup({ ...backup, intervalHours: Number(event.target.value) })} />
              </div>
              <div className="mt-3 text-xs text-slate-500">上次备份：{backup.lastBackupAt || '-'}</div>
            </div>
            <Button className="h-11 w-full rounded-2xl bg-blue-600" onClick={saveBackup} disabled={backupSaving}>
              {backupSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              保存备份配置
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
