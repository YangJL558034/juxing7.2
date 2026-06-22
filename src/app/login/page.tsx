'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
          localStorage.setItem('rememberedUsername', username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        setLoginSuccess(true);
        window.setTimeout(() => {
          window.location.href = '/';
        }, 850);
      } else {
        setError(data.error || '登录失败');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('网络错误，请稍后重试');
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    window.location.href = '/forgot-password';
  };

  const handleRegister = () => {
    window.location.href = '/register';
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* 紫色渐变背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-purple-700 to-purple-500" />
      
      {/* 左下角粉色橙色斜切渐变 */}
      <div 
        className="absolute bottom-0 left-0 w-1/2 h-1/2"
        style={{
          background: 'linear-gradient(135deg, #ff6b9d 0%, #ffa07a 50%, transparent 50%)',
        }}
      />

      {/* 几何线条装饰 */}
      <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
        <line x1="0" y1="0" x2="100%" y2="100%" stroke="white" strokeWidth="1" />
        <line x1="20%" y1="0" x2="100%" y2="80%" stroke="white" strokeWidth="0.5" />
        <line x1="0" y1="30%" x2="70%" y2="100%" stroke="white" strokeWidth="0.5" />
        <line x1="50%" y1="0" x2="100%" y2="50%" stroke="white" strokeWidth="0.5" />
      </svg>

      {loginSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="login-success-card w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="login-success-check mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white">
              <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="mt-4 text-xl font-semibold text-slate-950">登录成功</div>
            <div className="mt-2 text-sm text-slate-500">正在进入系统...</div>
          </div>
        </div>
      )}

      {/* 登录卡片 */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row w-full max-w-4xl mx-4">
        {/* 左侧插画区域 - 移动端隐藏 */}
        <div className="hidden md:flex w-1/2 bg-gradient-to-br from-purple-100 to-blue-50 items-center justify-center p-8">
          <div className="relative w-full max-w-sm aspect-square">
            <Image
              src="/logo.png"
              alt="聚星数据平台"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain drop-shadow-lg"
              priority
            />
          </div>
        </div>

        {/* 右侧表单区域 */}
        <div className="w-full md:w-1/2 p-8 sm:p-10 flex flex-col justify-center">
          {/* 标题区域 */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
              聚星数据平台
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              一款让数据管理更高效的智能CRM平台
            </p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* 表单 */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* 用户名输入框 */}
            <div className="space-y-2">
              <div className="flex items-center border-b-2 border-gray-200 focus-within:border-purple-500 transition-colors pb-2">
                <svg className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入管理员姓名"
                  className="flex-1 outline-none text-gray-700 placeholder-gray-400 bg-transparent text-sm sm:text-base"
                  required
                />
              </div>
            </div>

            {/* 密码输入框 */}
            <div className="space-y-2">
              <div className="flex items-center border-b-2 border-gray-200 focus-within:border-purple-500 transition-colors pb-2">
                <svg className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入登录密码"
                  className="flex-1 outline-none text-gray-700 placeholder-gray-400 bg-transparent text-sm sm:text-base"
                  required
                />
              </div>
            </div>

            {/* 记住用户名和忘记密码 */}
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-500">记住用户名</span>
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-purple-500 hover:text-purple-600 transition-colors"
              >
                忘记密码？
              </button>
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading || loginSuccess}
              className="login-action-button w-full py-3 px-4 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loginSuccess ? (
                '登录成功'
              ) : loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </button>
          </form>

          {/* 注册按钮 */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleRegister}
              className="w-full py-3 px-4 border-2 border-purple-200 text-purple-500 font-semibold rounded-xl hover:bg-purple-50 transition-all duration-200"
            >
              注册新账号
            </button>
          </div>

        </div>
      </div>

      {/* 版权信息 */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-white/50 text-xs">
        ©2026-2036 聚星数据平台 · 小杨开发 · 版权所有
      </div>
    </div>
  );
}
