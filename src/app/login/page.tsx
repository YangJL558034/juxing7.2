'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';

function safeNextPath() {
  const params = new URLSearchParams(window.location.search);
  const nextPath = params.get('next') || '/';
  return nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [mobileEntry, setMobileEntry] = useState(false);

  useEffect(() => {
    const rememberedUsername = window.localStorage.getItem('rememberedUsername');
    if (rememberedUsername) {
      setUsername(rememberedUsername);
      setRememberMe(true);
    }

    const nextPath = safeNextPath();
    setMobileEntry(nextPath.startsWith('/mobile') || window.matchMedia('(max-width: 768px)').matches);
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        if (rememberMe) {
          window.localStorage.setItem('rememberedUsername', username);
        } else {
          window.localStorage.removeItem('rememberedUsername');
        }
        if (data.token) {
          window.localStorage.setItem('token', data.token);
        }

        setLoginSuccess(true);
        window.setTimeout(() => {
          window.location.href = safeNextPath();
        }, 850);
      } else {
        setError(data.error || '登录失败');
        setLoading(false);
      }
    } catch (loginError) {
      console.error('Login error:', loginError);
      setError('网络错误，请稍后重试');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh overflow-hidden bg-[#f5f7fb] text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_88%_20%,rgba(14,165,233,0.16),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f5f7fb_42%,#edf3ff_100%)]" />

      {loginSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="login-success-card w-full max-w-xs rounded-[32px] bg-white p-7 text-center shadow-2xl">
            <div className="login-success-check mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="mt-4 text-xl font-semibold text-slate-950">登录成功</div>
            <div className="mt-2 text-sm text-slate-500">正在进入系统...</div>
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-h-dvh items-center justify-center px-5 py-[max(1.1rem,env(safe-area-inset-top))]">
        <section className="w-full max-w-md">
          <div className="mobile-ios-glass mb-4 rounded-[32px] p-4 text-slate-950">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold shadow-lg shadow-blue-600/30">
                聚
              </div>
              <div className="rounded-full border border-white/70 bg-white/[0.58] px-3 py-1 text-xs font-medium text-slate-600 backdrop-blur-xl">
                {mobileEntry ? '移动端登录' : '系统登录'}
              </div>
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-normal">聚星数据平台</h1>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              登录后进入移动端后台，数据和电脑端实时同步。
            </p>
          </div>

          <form onSubmit={handleLogin} className="rounded-[32px] border border-white/75 bg-white/[0.92] p-4 shadow-[0_18px_54px_rgba(15,23,42,0.11)] backdrop-blur-2xl">
            {error && (
              <div className="mb-4 rounded-[20px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block px-1 text-sm font-medium text-slate-600">用户名</span>
                <span className="flex h-12 items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 transition focus-within:border-blue-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.08)]">
                  <UserRound className="h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="请输入用户名"
                    className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
                    required
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block px-1 text-sm font-medium text-slate-600">密码</span>
                <span className="flex h-12 items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 transition focus-within:border-blue-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.08)]">
                  <LockKeyhole className="h-5 w-5 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="请输入密码"
                    className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
                    required
                  />
                </span>
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                记住用户名
              </label>
              <button
                type="button"
                onClick={() => { window.location.href = '/forgot-password'; }}
                className="text-sm font-medium text-blue-600"
              >
                忘记密码？
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || loginSuccess}
              className="login-action-button mt-5 flex h-12 w-full items-center justify-center rounded-[22px] bg-blue-600 px-4 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loginSuccess ? (
                '登录成功'
              ) : loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </button>

            <button
              type="button"
              onClick={() => { window.location.href = '/register'; }}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-[20px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              注册新账号
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            账号权限与电脑端后台一致
          </div>
        </section>
      </div>
    </main>
  );
}
