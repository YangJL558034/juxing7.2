'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Download, FileText, IdCard, Loader2, Search, Send, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ResignationCertificateFormData, ResignationCertificateType } from '@/types/resignation-certificate';

function chinaTodayInput() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function createDefaultData(): ResignationCertificateFormData {
  return {
    certificateType: 'personal',
    employeeName: '',
    idCard: '',
    phone: '',
    email: '',
    honorific: '女士',
    department: '',
    position: '',
    hireDate: '',
    leaveDate: '',
    issueDate: chinaTodayInput(),
    companyName: '东莞山泽新能源有限公司',
    receiptDate: '',
    reviewerName: '',
    reviewRemark: '',
    stampedFileName: '',
    stampedFileMime: '',
    remark: '',
  };
}

function RequiredMark() {
  return <span className="ml-0.5 text-red-500">*</span>;
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
      <label className="text-sm font-medium leading-5 text-slate-800">
        {label}
        {required && <RequiredMark />}
      </label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 text-base" />
    </div>
  );
}

interface QueryRecord {
  id: number;
  employeeName: string;
  certificateType: ResignationCertificateType;
  issueDate: string;
  completedAt: string;
  stampedFileName: string;
}

export default function ResignationCertificatePage() {
  const [mode, setMode] = useState<'apply' | 'query'>(() => {
    if (typeof window === 'undefined') return 'apply';
    return new URLSearchParams(window.location.search).get('query') === '1' ? 'query' : 'apply';
  });
  const [data, setData] = useState<ResignationCertificateFormData>(() => createDefaultData());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [queryName, setQueryName] = useState('');
  const [queryIdCard, setQueryIdCard] = useState('');
  const [querying, setQuerying] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [queryRecord, setQueryRecord] = useState<QueryRecord | null>(null);
  const [downloading, setDownloading] = useState(false);

  const canSubmit = useMemo(() => {
    return data.employeeName && data.idCard && data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  }, [data]);

  const update = <K extends keyof ResignationCertificateFormData>(field: K, value: ResignationCertificateFormData[K]) => {
    setData((current) => ({ ...current, [field]: value }));
  };

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/resignation-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || '提交失败');
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const query = async () => {
    if (!queryName || !queryIdCard || querying) return;
    setQuerying(true);
    setQueryError('');
    setQueryRecord(null);
    try {
      const response = await fetch('/api/resignation-certificate-public/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeName: queryName, idCard: queryIdCard }),
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; error?: string; record?: QueryRecord };
      if (!response.ok || !result.success || !result.record) throw new Error(result.error || '查询失败');
      setQueryRecord(result.record);
    } catch (queryFailure) {
      setQueryError(queryFailure instanceof Error ? queryFailure.message : '查询失败');
    } finally {
      setQuerying(false);
    }
  };

  const download = async () => {
    if (!queryRecord || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch('/api/resignation-certificate-public/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeName: queryName, idCard: queryIdCard }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || '下载失败');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = queryRecord.stampedFileName || `${queryRecord.employeeName}-离职证明`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      alert(downloadError instanceof Error ? downloadError.message : '下载失败');
    } finally {
      setDownloading(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
        <div className="mx-auto max-w-md rounded-lg border border-slate-100 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-xl font-semibold">离职证明申请提交成功</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">后台审核并上传盖章离职证明后，可在本入口查询下载；邮件发送成功时会同步通知你。</p>
          <Button className="mt-6 w-full bg-blue-600 hover:bg-blue-700" onClick={() => {
            setData(createDefaultData());
            setSubmitted(false);
          }}>
            继续申请
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <p className="text-xs text-slate-500">移动端入口</p>
          <h1 className="text-lg font-semibold">离职证明</h1>
          <div className="mt-3 grid grid-cols-2 rounded-md bg-slate-100 p-1">
            <button type="button" className={`h-9 rounded text-sm ${mode === 'apply' ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`} onClick={() => setMode('apply')}>申请</button>
            <button type="button" className={`h-9 rounded text-sm ${mode === 'query' ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`} onClick={() => setMode('query')}>查询下载</button>
          </div>
        </div>
      </div>

      {mode === 'apply' ? (
        <div className="mx-auto max-w-md space-y-4 px-4 py-4">
          {error && <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <section className="rounded-lg border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
              <UserRound className="h-4 w-4 text-blue-600" />
              <h2 className="text-base font-semibold">申请人信息</h2>
            </div>
            <div className="space-y-4 p-3">
              <Field label="姓名" required value={data.employeeName} onChange={(value) => update('employeeName', value)} placeholder="请输入姓名" />
              <Field label="身份证" required value={data.idCard} onChange={(value) => update('idCard', value)} placeholder="请输入身份证号码" />
              <Field label="邮箱" required type="email" value={data.email} onChange={(value) => update('email', value)} placeholder="用于接收查询链接" />
              <Field label="手机号" value={data.phone} onChange={(value) => update('phone', value)} placeholder="请输入手机号" />
              <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
                <label className="text-sm font-medium text-slate-800">称谓</label>
                <select value={data.honorific} onChange={(event) => update('honorific', event.target.value as ResignationCertificateFormData['honorific'])} className="h-11 rounded-md border border-slate-200 bg-white px-3 text-base outline-none focus:border-blue-500">
                  <option value="女士">女士</option>
                  <option value="先生">先生</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
              <FileText className="h-4 w-4 text-blue-600" />
              <h2 className="text-base font-semibold">证明类型</h2>
            </div>
            <div className="space-y-4 p-3">
              <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
                <label className="text-sm font-medium text-slate-800">类型</label>
                <select value={data.certificateType} onChange={(event) => update('certificateType', event.target.value as ResignationCertificateType)} className="h-11 rounded-md border border-slate-200 bg-white px-3 text-base outline-none focus:border-blue-500">
                  <option value="personal">个人辞职</option>
                  <option value="company">公司提出</option>
                </select>
              </div>
              <p className="text-xs leading-5 text-slate-500">部门、岗位、入职日期、离职日期由后台审核时补充，以公司最终审核内容为准。</p>
            </div>
          </section>

          <Button className="mobile-submit-button h-12 w-full bg-blue-600 text-base hover:bg-blue-700" disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            提交申请
          </Button>
        </div>
      ) : (
        <div className="mx-auto max-w-md space-y-4 px-4 py-4">
          {queryError && <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{queryError}</div>}
          <section className="rounded-lg border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
              <IdCard className="h-4 w-4 text-blue-600" />
              <h2 className="text-base font-semibold">身份验证</h2>
            </div>
            <div className="space-y-4 p-3">
              <Field label="姓名" required value={queryName} onChange={setQueryName} placeholder="请输入申请人姓名" />
              <Field label="身份证" required value={queryIdCard} onChange={setQueryIdCard} placeholder="请输入身份证号码" />
              <p className="text-xs leading-5 text-slate-500">离职证明完成后半个月内可在这里查询下载，超过半个月请联系公司人事部门。</p>
            </div>
          </section>

          <Button className="h-12 w-full bg-slate-950 text-base hover:bg-slate-800" disabled={!queryName || !queryIdCard || querying} onClick={query}>
            {querying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            查询
          </Button>

          {queryRecord && (
            <section className="rounded-lg border border-emerald-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">已查询到离职证明</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>申请人：{queryRecord.employeeName}</p>
                <p>开具日期：{queryRecord.issueDate || '-'}</p>
                <p>文件：{queryRecord.stampedFileName || '离职证明'}</p>
              </div>
              <Button className="mt-4 h-11 w-full bg-blue-600 hover:bg-blue-700" onClick={download} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                下载离职证明
              </Button>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
