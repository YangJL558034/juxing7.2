'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, RefreshCcw, Send, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type AppUser = {
  id: number;
  username: string;
  name: string;
  role: string;
  department?: string;
};

interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

const quickPrompts = ['查询客户', '生成注册码', '查看合同', '商机统计', '待审核数量', '帮助'];

export default function MobileAiChatPage({ user }: { user?: AppUser }) {
  const userId = user?.id;
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '我是 AI 对话助手，可以帮你查询客户、合同、审批、统计和生成管理事项。' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async () => {
    if (!userId) return;
    const response = await fetch(`/api/chat/messages?userId=${userId}`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (data.success && Array.isArray(data.messages) && data.messages.length) {
      setMessages(data.messages.map((item: ChatMessage) => ({
        id: item.id,
        role: item.role,
        content: item.content,
        created_at: item.created_at,
      })));
    }
  }, [userId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const saveMessage = async (message: ChatMessage) => {
    if (!userId) return;
    await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: message.role, content: message.content }),
    }).catch(() => undefined);
  };

  const submit = async (event?: FormEvent, prompt?: string) => {
    event?.preventDefault();
    const text = (prompt || input).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);
    await saveMessage(userMessage);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: text, intent: text }),
      });
      const data = await response.json().catch(() => ({}));
      const assistantText = data.message || data.reply || data.error || '我已经收到请求，但没有返回具体内容。';
      const assistantMessage: ChatMessage = { role: 'assistant', content: assistantText };
      setMessages((current) => [...current, assistantMessage]);
      await saveMessage(assistantMessage);
    } catch {
      const assistantMessage: ChatMessage = { role: 'assistant', content: '请求失败，请稍后重试。' };
      setMessages((current) => [...current, assistantMessage]);
      await saveMessage(assistantMessage);
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = async () => {
    if (!userId) return;
    if (!confirm('确定清空当前对话吗？')) return;
    await fetch(`/api/chat/messages?userId=${userId}`, { method: 'DELETE' }).catch(() => undefined);
    setMessages([{ role: 'assistant', content: '对话已清空，你可以继续提问。' }]);
  };

  return (
    <div className="flex h-[calc(100dvh-9.8rem)] min-h-[620px] flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white/[0.9] shadow-sm backdrop-blur-xl">
      <section className="mobile-ios-glass m-3 rounded-[24px] p-4 text-slate-950">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">AI 对话助手</h1>
              <p className="text-xs text-slate-600">智能生成与管理助手</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white/[0.6]" onClick={() => void loadMessages()}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-10 w-10 rounded-2xl bg-white/[0.6]" onClick={() => void clearMessages()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          return (
            <div key={`${message.id || index}-${message.role}`} className={cn('flex gap-2', isUser && 'justify-end')}>
              {!isUser && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div className={cn('max-w-[78%] whitespace-pre-wrap rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm', isUser ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800')}>
                {message.content}
              </div>
              {isUser && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <UserRound className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="flex gap-2">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 rounded-[22px] bg-slate-100 px-4 py-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在思考
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-100 bg-white/[0.82] p-3 backdrop-blur-xl">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
              onClick={() => void submit(undefined, prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
        <form className="grid grid-cols-[1fr_auto] gap-2" onSubmit={(event) => void submit(event)}>
          <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="输入您的问题..." className="h-11 rounded-2xl bg-slate-50 text-base" />
          <Button type="submit" size="icon" className="h-11 w-11 rounded-2xl bg-blue-600" disabled={loading}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
