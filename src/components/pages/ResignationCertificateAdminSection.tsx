'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, Eye, FileCheck2, FileText, Loader2, Plus, Printer, RefreshCcw, RotateCcw, Search, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type {
  ResignationCertificateFormData,
  ResignationCertificateRecord,
  ResignationCertificateType,
} from '@/types/resignation-certificate';
import YearMonthGroupedTableBody from './YearMonthGroupedTableBody';

interface ListResponse {
  success: boolean;
  records?: ResignationCertificateRecord[];
  error?: string;
}

interface MutateResponse {
  success: boolean;
  record?: ResignationCertificateRecord;
  error?: string;
  message?: string;
  emailSent?: boolean;
  emailError?: string | null;
}

type ListMode = 'pending' | 'completed' | 'deleted';
type FormMode = 'create' | 'edit';
type OutputType = 'certificate' | 'receipt';

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

function createEmptyData(): ResignationCertificateFormData {
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

function display(value: unknown) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return String(value).replace('T', ' ').slice(0, 19);
}

function certificateTypeLabel(value: ResignationCertificateType) {
  return value === 'company' ? '公司提出' : '个人辞职';
}

function cloneData(record: ResignationCertificateRecord): ResignationCertificateFormData {
  return JSON.parse(JSON.stringify(record.data)) as ResignationCertificateFormData;
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function InfoGrid({ pairs }: { pairs: Array<[string, unknown]> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {pairs.map(([label, value]) => (
        <div key={label} className="rounded-md bg-slate-50 px-3 py-2">
          <div className="text-xs text-slate-500">{label}</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{display(value)}</div>
        </div>
      ))}
    </div>
  );
}

export default function ResignationCertificateAdminSection() {
  const [records, setRecords] = useState<ResignationCertificateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [listMode, setListMode] = useState<ListMode>('pending');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<ResignationCertificateRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [formTarget, setFormTarget] = useState<ResignationCertificateRecord | null>(null);
  const [formData, setFormData] = useState<ResignationCertificateFormData>(createEmptyData);
  const [saving, setSaving] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (listMode === 'deleted') params.set('deleted', '1');
      if (listMode !== 'deleted') params.set('status', listMode === 'completed' ? '已完成' : '待审核');
      if (keyword.trim()) params.set('keyword', keyword.trim());
      const response = await fetch(`/api/resignation-certificate?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as ListResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取离职证明记录失败');
      }
      setRecords(result.records || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取离职证明记录失败');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [keyword, listMode]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const updateField = <K extends keyof ResignationCertificateFormData>(field: K, value: ResignationCertificateFormData[K]) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const openCreate = () => {
    setFormMode('create');
    setFormTarget(null);
    setFormData(createEmptyData());
    setFormOpen(true);
  };

  const openEdit = (record: ResignationCertificateRecord) => {
    setFormMode('edit');
    setFormTarget(record);
    setFormData(cloneData(record));
    setFormOpen(true);
  };

  const openView = (record: ResignationCertificateRecord) => {
    setViewTarget(record);
    setViewOpen(true);
  };

  const submitForm = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        formMode === 'create' ? '/api/resignation-certificate' : `/api/resignation-certificate/${formTarget?.id}`,
        {
          method: formMode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: formData }),
        },
      );
      const result = await response.json().catch(() => ({})) as MutateResponse;
      if (!response.ok || !result.success || !result.record) {
        throw new Error(result.error || (formMode === 'create' ? '保存离职证明失败' : '审核离职证明失败'));
      }
      setFormOpen(false);
      setFormTarget(null);
      setListMode('pending');
      await loadRecords();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : '保存离职证明失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record: ResignationCertificateRecord) => {
    if (!confirm(`确定删除 ${record.employeeName} 的离职证明吗？删除后一周内可恢复，超过一周会完全清除。`)) return;
    try {
      const response = await fetch(`/api/resignation-certificate/${record.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as MutateResponse;
      if (!response.ok || !result.success) throw new Error(result.error || '删除离职证明失败');
      await loadRecords();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '删除离职证明失败');
    }
  };

  const restoreRecord = async (record: ResignationCertificateRecord) => {
    try {
      const response = await fetch(`/api/resignation-certificate/${record.id}/restore`, { method: 'PATCH' });
      const result = await response.json().catch(() => ({})) as MutateResponse;
      if (!response.ok || !result.success) throw new Error(result.error || '恢复离职证明失败');
      await loadRecords();
    } catch (restoreError) {
      alert(restoreError instanceof Error ? restoreError.message : '恢复离职证明失败');
    }
  };

  const exportRecord = (record: ResignationCertificateRecord, type: OutputType) => {
    window.open(`/api/resignation-certificate/${record.id}/export?type=${type}`, '_blank', 'noopener,noreferrer');
    setTimeout(() => void loadRecords(), 800);
  };

  const printRecord = (record: ResignationCertificateRecord, type: OutputType) => {
    window.open(`/api/resignation-certificate/${record.id}/print?type=${type}`, '_blank', 'noopener,noreferrer');
    setTimeout(() => void loadRecords(), 800);
  };

  const openStampedFile = (record: ResignationCertificateRecord) => {
    if (!record.hasStampedFile) {
      alert('当前记录还没有上传盖章证明文件');
      return;
    }
    window.open(`/api/resignation-certificate/${record.id}/stamped-file`, '_blank', 'noopener,noreferrer');
  };

  const completeRecord = async (record: ResignationCertificateRecord) => {
    if (!record.hasStampedFile) {
      alert('请先在审核里上传已经盖章的离职证明文件');
      return;
    }
    if (!confirm(`确定完成 ${record.employeeName} 的离职证明并尝试发送邮件通知吗？邮件发送失败也会保留查询下载。`)) return;
    try {
      const response = await fetch(`/api/resignation-certificate/${record.id}/complete`, { method: 'PATCH' });
      const result = await response.json().catch(() => ({})) as MutateResponse;
      if (!response.ok || !result.success) throw new Error(result.error || '完成离职证明失败');
      if (result.message) alert(result.message);
      setListMode('completed');
      await loadRecords();
    } catch (completeError) {
      alert(completeError instanceof Error ? completeError.message : '完成离职证明失败');
    }
  };

  const exportApplicantList = () => {
    const params = new URLSearchParams();
    if (listMode === 'deleted') params.set('deleted', '1');
    if (listMode !== 'deleted') params.set('status', listMode === 'completed' ? '已完成' : '待审核');
    if (keyword.trim()) params.set('keyword', keyword.trim());
    window.open(`/api/resignation-certificate/export-list?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const handleStampedFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('盖章文件不能超过10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateField('stampedFileName', file.name);
      updateField('stampedFileMime', file.type || 'application/octet-stream');
      updateField('stampedFileData', String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const runSearch = () => setKeyword(keywordInput);

  return (
    <div className="mt-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <FileText className="h-4 w-4 text-blue-600" />
            离职证明
          </div>
          <p className="mt-1 text-sm text-slate-500">使用上传的个人辞职版、公司提出版和签收回执模板，后台填写后可直接打印或导出。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center rounded-md border border-slate-200 bg-white px-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runSearch();
              }}
              placeholder="搜索姓名/部门"
              className="h-full w-36 bg-transparent px-2 text-sm outline-none"
            />
          </div>
          <Button variant="outline" onClick={runSearch}>搜索</Button>
          <Button
            variant={listMode === 'pending' ? 'default' : 'outline'}
            className={listMode === 'pending' ? 'bg-slate-950 hover:bg-slate-800' : ''}
            onClick={() => setListMode('pending')}
          >
            待审核
          </Button>
          <Button
            variant={listMode === 'completed' ? 'default' : 'outline'}
            className={listMode === 'completed' ? 'bg-slate-950 hover:bg-slate-800' : ''}
            onClick={() => setListMode('completed')}
          >
            已完成
          </Button>
          <Button
            variant={listMode === 'deleted' ? 'default' : 'outline'}
            className={listMode === 'deleted' ? 'bg-slate-950 hover:bg-slate-800' : ''}
            onClick={() => setListMode('deleted')}
          >
            已删除
          </Button>
          <Button variant="outline" onClick={() => void loadRecords()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            刷新
          </Button>
          <Button variant="outline" onClick={exportApplicantList}>
            <Download className="h-4 w-4" />
            导出申请人名单
          </Button>
          <Button asChild variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
            <Link href="/resignation-certificate" target="_blank">打开移动端入口</Link>
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增离职证明
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>身份证</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>部门</TableHead>
              <TableHead>职务</TableHead>
              <TableHead>入职日期</TableHead>
              <TableHead>离职日期</TableHead>
              <TableHead>开具日期</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>盖章件</TableHead>
              {listMode === 'deleted' && <TableHead>恢复截止</TableHead>}
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <YearMonthGroupedTableBody
            records={records}
            loading={loading}
            colSpan={listMode === 'deleted' ? 13 : 12}
            loadingText="正在加载离职证明..."
            emptyText={listMode === 'deleted' ? '暂无已删除离职证明' : '暂无离职证明记录'}
            getDate={(record) => record.createdAt}
            renderRow={(record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium text-slate-900">{display(record.employeeName)}</TableCell>
                <TableCell>{display(record.idCard)}</TableCell>
                <TableCell>{display(record.email)}</TableCell>
                <TableCell>{certificateTypeLabel(record.certificateType)}</TableCell>
                <TableCell>{display(record.department)}</TableCell>
                <TableCell>{display(record.position)}</TableCell>
                <TableCell>{formatDate(record.hireDate)}</TableCell>
                <TableCell>{formatDate(record.leaveDate)}</TableCell>
                <TableCell>{formatDate(record.issueDate)}</TableCell>
                <TableCell>{record.deletedAt ? '已删除' : record.status}</TableCell>
                <TableCell>{record.hasStampedFile ? '已上传' : '未上传'}</TableCell>
                {listMode === 'deleted' && <TableCell>{formatDateTime(record.restoreUntil)}</TableCell>}
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openView(record)}>
                      <Eye className="h-4 w-4" />
                      查看
                    </Button>
                    {listMode === 'deleted' ? (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => restoreRecord(record)}>
                        <RotateCcw className="h-4 w-4" />
                        恢复
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEdit(record)}>
                          <FileCheck2 className="h-4 w-4" />
                          审核
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportRecord(record, 'certificate')}>
                          <Download className="h-4 w-4" />
                          导出证明
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => printRecord(record, 'certificate')}>
                          <Printer className="h-4 w-4" />
                          打印证明
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportRecord(record, 'receipt')}>
                          <Download className="h-4 w-4" />
                          导出回执
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => printRecord(record, 'receipt')}>
                          <Printer className="h-4 w-4" />
                          打印回执
                        </Button>
                        {record.status !== '已完成' && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => completeRecord(record)} disabled={!record.hasStampedFile}>
                            <CheckCircle2 className="h-4 w-4" />
                            完成并通知
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => deleteRecord(record)}>
                          <Trash2 className="h-4 w-4" />
                          删除
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          />
        </Table>
      </div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>查看离职证明</DialogTitle>
            <DialogDescription>查看证明内容、导出打印记录和删除恢复时间。</DialogDescription>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4">
              <InfoGrid pairs={[
                ['姓名', viewTarget.employeeName],
                ['身份证', viewTarget.idCard],
                ['手机号', viewTarget.phone],
                ['邮箱', viewTarget.email],
                ['称谓', viewTarget.honorific],
                ['状态', viewTarget.deletedAt ? '已删除' : viewTarget.status],
                ['类型', certificateTypeLabel(viewTarget.certificateType)],
                ['部门', viewTarget.department],
                ['职务', viewTarget.position],
                ['入职日期', formatDate(viewTarget.hireDate)],
                ['离职日期', formatDate(viewTarget.leaveDate)],
                ['开具日期', formatDate(viewTarget.issueDate)],
                ['公司名称', viewTarget.companyName],
                ['签收日期', formatDate(viewTarget.receiptDate)],
                ['审核人', viewTarget.reviewerName],
                ['审核时间', formatDateTime(viewTarget.reviewedAt)],
                ['是否上传盖章件', viewTarget.hasStampedFile ? '已上传' : '未上传'],
                ['盖章文件', viewTarget.stampedFileName],
                ['完成时间', formatDateTime(viewTarget.completedAt)],
                ['邮件发送时间', formatDateTime(viewTarget.emailSentAt)],
                ['邮件错误', viewTarget.emailError],
                ['创建人', viewTarget.createdByName],
                ['创建时间', formatDateTime(viewTarget.createdAt)],
                ['证明导出时间', formatDateTime(viewTarget.certificateExportedAt)],
                ['证明打印时间', formatDateTime(viewTarget.certificatePrintedAt)],
                ['回执导出时间', formatDateTime(viewTarget.receiptExportedAt)],
                ['回执打印时间', formatDateTime(viewTarget.receiptPrintedAt)],
                ['删除时间', formatDateTime(viewTarget.deletedAt)],
                ['恢复截止', formatDateTime(viewTarget.restoreUntil)],
              ]} />
              {viewTarget.hasStampedFile && (
                <div className="flex flex-col gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-sm text-blue-900">
                    <div className="font-medium">已上传盖章证明文件</div>
                    <div className="truncate text-blue-700">{viewTarget.stampedFileName || '离职证明文件'}</div>
                  </div>
                  <Button variant="outline" className="border-blue-200 bg-white text-blue-700 hover:bg-blue-100" onClick={() => openStampedFile(viewTarget)}>
                    <Eye className="h-4 w-4" />
                    查看上传文件
                  </Button>
                </div>
              )}
              {viewTarget.data.remark && (
                <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="mb-1 font-medium text-slate-900">备注</div>
                  <div className="whitespace-pre-wrap leading-6">{viewTarget.data.remark}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? '新增离职证明' : '审核离职证明'}</DialogTitle>
            <DialogDescription>选择个人辞职版或公司提出版，签收回执会使用同一条记录自动填充。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">证明类型<span className="ml-1 text-red-500">*</span></label>
                <Select value={formData.certificateType} onValueChange={(value) => updateField('certificateType', value as ResignationCertificateType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">个人辞职</SelectItem>
                    <SelectItem value="company">公司提出</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="员工姓名" required value={formData.employeeName} onChange={(value) => updateField('employeeName', value)} />
              <Field label="身份证" required value={formData.idCard} onChange={(value) => updateField('idCard', value)} />
              <Field label="邮箱" required type="email" value={formData.email} onChange={(value) => updateField('email', value)} />
              <Field label="手机号" value={formData.phone} onChange={(value) => updateField('phone', value)} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">称谓<span className="ml-1 text-red-500">*</span></label>
                <Select value={formData.honorific} onValueChange={(value) => updateField('honorific', value as ResignationCertificateFormData['honorific'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="女士">女士</SelectItem>
                    <SelectItem value="先生">先生</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="部门" required value={formData.department} onChange={(value) => updateField('department', value)} />
              <Field label="职务" required value={formData.position} onChange={(value) => updateField('position', value)} />
              <Field label="入职日期" required type="date" value={formData.hireDate} onChange={(value) => updateField('hireDate', value)} />
              <Field label="离职日期" required type="date" value={formData.leaveDate} onChange={(value) => updateField('leaveDate', value)} />
              <Field label="开具日期" required type="date" value={formData.issueDate} onChange={(value) => updateField('issueDate', value)} />
              <Field label="公司名称" required value={formData.companyName} onChange={(value) => updateField('companyName', value)} />
              <Field label="回执签收日期" type="date" value={formData.receiptDate} onChange={(value) => updateField('receiptDate', value)} />
              <Field label="审核人" value={formData.reviewerName} onChange={(value) => updateField('reviewerName', value)} />
            </div>
            <div className="space-y-1.5 rounded-md border border-dashed border-slate-200 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Upload className="h-4 w-4 text-blue-600" />
                上传已盖章离职证明
              </label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                onChange={(event) => handleStampedFile(event.target.files?.[0] || null)}
              />
              <p className="text-xs text-slate-500">
                {formData.stampedFileName ? `已选择：${formData.stampedFileName}` : '必须上传已盖章/已打好的证明文件后，才能点击完成并发邮件。'}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">审核备注</label>
              <Textarea value={formData.reviewRemark} onChange={(event) => updateField('reviewRemark', event.target.value)} className="min-h-20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">备注</label>
              <Textarea value={formData.remark} onChange={(event) => updateField('remark', event.target.value)} className="min-h-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>取消</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={submitForm} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {formMode === 'create' ? '保存记录' : '保存审核'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
