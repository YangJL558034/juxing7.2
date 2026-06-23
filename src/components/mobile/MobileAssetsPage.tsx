'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Download,
  Folder,
  Loader2,
  Pencil,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { chinaToday } from '@/lib/china-time';

interface AssetConfig {
  cpu?: string;
  memory?: string;
  gpu?: string;
  storage?: string;
  monitor?: string;
  system?: string;
}

interface Asset {
  id: number;
  name: string;
  type: string;
  department: string;
  user: string;
  status: string;
  value: number;
  purchase_date: string;
  config?: AssetConfig | null;
  created_at: string;
  scrap_time?: string;
  scrap_confirmer?: string;
  claim_time?: string;
}

interface AssetResponse {
  success: boolean;
  data?: Asset[];
  error?: string;
}

const assetTypes = ['电脑', '笔记本电脑', '显示器', '手机', '平板电脑', '电视机', '路由器', '扫码枪', '空调遥控器', '自定义'];

function display(value?: string | number | null) {
  if (value === undefined || value === null) return '-';
  const text = String(value).trim();
  return text || '-';
}

function formatMoney(value?: string | number | null) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function statusTone(status?: string) {
  const text = String(status || '');
  if (text.includes('报废')) return 'bg-red-50 text-red-700 ring-red-200';
  if (text.includes('闲置')) return 'bg-slate-100 text-slate-700 ring-slate-200';
  if (text.includes('维修')) return 'bg-orange-50 text-orange-700 ring-orange-200';
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
}

function createEmptyAsset() {
  return {
    name: '',
    type: '电脑',
    department: '',
    user: '',
    value: '',
    purchase_date: chinaToday(),
  };
}

function createEmptyBulkAsset() {
  return {
    type: '电脑',
    namePrefix: '资产',
    department: '',
    user: '',
    value: '0',
    purchase_date: chinaToday(),
    count: '10',
    startNumber: '1',
  };
}

export default function MobileAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [assetForm, setAssetForm] = useState(createEmptyAsset);
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(createEmptyBulkAsset);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<{ qrCode: string; url: string } | null>(null);
  const [downloadingQr, setDownloadingQr] = useState(false);

  const loadAssets = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/assets', { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as AssetResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取资产失败');
      }
      setAssets(result.data || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取资产失败');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssets();
  }, []);

  const types = useMemo(() => {
    const set = new Set(assets.map((asset) => asset.type).filter(Boolean));
    return Array.from(set);
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesType = typeFilter === 'all' || asset.type === typeFilter;
      const matchesKeyword = !keyword || `${asset.name} ${asset.type} ${asset.department} ${asset.user}`.toLowerCase().includes(keyword);
      return matchesType && matchesKeyword;
    });
  }, [assets, query, typeFilter]);

  const stats = useMemo(() => {
    const inUse = assets.filter((asset) => String(asset.status || '').includes('使用')).length;
    const idle = assets.filter((asset) => String(asset.status || '').includes('闲置')).length;
    const scrap = assets.filter((asset) => String(asset.status || '').includes('报废')).length;
    return { total: assets.length, inUse, idle, scrap };
  }, [assets]);

  const openCreate = () => {
    setEditingAsset(null);
    setAssetForm(createEmptyAsset());
    setFormOpen(true);
  };

  const openEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name || '',
      type: asset.type || '电脑',
      department: asset.department || '',
      user: asset.user || '',
      value: String(asset.value || ''),
      purchase_date: asset.purchase_date || chinaToday(),
    });
    setFormOpen(true);
  };

  const submitAsset = async () => {
    if (!assetForm.name.trim() || !assetForm.type.trim()) {
      alert('资产名称和类型不能为空');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/assets', {
        method: editingAsset ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAsset?.id,
          ...assetForm,
          value: Number(assetForm.value || 0),
        }),
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || '保存资产失败');
      }
      setFormOpen(false);
      await loadAssets();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : '保存资产失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteAsset = async (asset: Asset) => {
    if (!confirm(`确定删除资产 ${asset.name} 吗？`)) return;
    try {
      const response = await fetch(`/api/assets?id=${asset.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || '删除资产失败');
      }
      setDetailOpen(false);
      await loadAssets();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : '删除资产失败');
    }
  };

  const showQrCode = async (asset: Asset) => {
    try {
      const response = await fetch(`/api/assets/qrcode?id=${asset.id}`);
      const result = await response.json().catch(() => ({})) as { success?: boolean; data?: { qrCode: string; url: string }; error?: string };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || '生成二维码失败');
      }
      setQrData(result.data);
      setQrOpen(true);
    } catch (qrError) {
      alert(qrError instanceof Error ? qrError.message : '生成二维码失败');
    }
  };

  const downloadAllQRCodes = async () => {
    if (assets.length === 0) {
      alert('暂无资产二维码可下载');
      return;
    }

    setDownloadingQr(true);
    try {
      const response = await fetch('/api/assets/qrcode/batch');
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || '下载二维码失败');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `资产二维码_${chinaToday()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      alert(downloadError instanceof Error ? downloadError.message : '下载二维码失败');
    } finally {
      setDownloadingQr(false);
    }
  };

  const submitBulkGenerate = async () => {
    if (!bulkForm.type.trim() || !bulkForm.namePrefix.trim() || !bulkForm.department.trim()) {
      alert('类型、名称前缀和部门不能为空');
      return;
    }

    setBulkSaving(true);
    try {
      const response = await fetch('/api/assets/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkForm),
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; error?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.error || '一键生成资产失败');
      }
      setBulkOpen(false);
      setBulkForm(createEmptyBulkAsset());
      await loadAssets();
    } catch (bulkError) {
      alert(bulkError instanceof Error ? bulkError.message : '一键生成资产失败');
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="mobile-ios-glass rounded-[30px] p-5 text-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/[0.58] px-2.5 py-1 text-xs font-medium text-blue-700 backdrop-blur-xl">
              <Sparkles className="h-3.5 w-3.5" />
              资产移动管理
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-normal">资产管理</h1>
            <p className="mt-2 text-sm text-slate-600">分类查看、二维码下载和批量生成。</p>
          </div>
          <Button size="icon" variant="secondary" className="h-11 w-11 rounded-2xl border border-white/70 bg-white/[0.58] text-blue-700 shadow-sm backdrop-blur-xl hover:bg-white/75" onClick={() => void loadAssets()} disabled={loading}>
            <RefreshCcw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {[
            ['总数', stats.total],
            ['使用', stats.inUse],
            ['闲置', stats.idle],
            ['报废', stats.scrap],
          ].map(([label, value]) => (
            <div key={label} className="mobile-ios-tile rounded-2xl p-3 text-center">
              <div className="text-xl font-bold">{value}</div>
              <div className="mt-1 text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索资产、部门、使用人"
            className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-9 text-base"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={cn('shrink-0 rounded-full px-4 py-2 text-sm font-medium', typeFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}
          >
            全部
          </button>
          {types.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={cn('shrink-0 rounded-full px-4 py-2 text-sm font-medium', typeFilter === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}
            >
              {type}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Button className="h-12 rounded-2xl bg-blue-600" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          新增
        </Button>
        <Button variant="outline" className="h-12 rounded-2xl" onClick={() => setBulkOpen(true)}>
          <Archive className="mr-1 h-4 w-4" />
          生成
        </Button>
        <Button variant="outline" className="h-12 rounded-2xl" onClick={() => void downloadAllQRCodes()} disabled={downloadingQr}>
          {downloadingQr ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
          二维码
        </Button>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-slate-950">资产列表</h2>
          <span className="text-sm text-slate-500">{filteredAssets.length} 条</span>
        </div>

        {loading && (
          <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" />
            正在加载
          </div>
        )}

        {!loading && filteredAssets.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">暂无资产</div>
        )}

        {!loading && filteredAssets.map((asset) => (
          <article key={asset.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Folder className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-semibold text-slate-950">{asset.name}</h3>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1', statusTone(asset.status))}>{display(asset.status)}</span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{display(asset.type)} / {display(asset.department)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">使用人</div>
                <div className="mt-1 font-medium text-slate-900">{display(asset.user)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">价值</div>
                <div className="mt-1 font-medium text-slate-900">￥{formatMoney(asset.value)}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => { setSelectedAsset(asset); setDetailOpen(true); }}>
                查看
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => void showQrCode(asset)}>
                <QrCode className="mr-1 h-4 w-4" />
                二维码
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(asset)}>
                <Pencil className="mr-1 h-4 w-4" />
                修改
              </Button>
            </div>
          </article>
        ))}
      </section>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="max-h-[86dvh] rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>{selectedAsset?.name || '资产详情'}</SheetTitle>
            <SheetDescription>{selectedAsset ? `${display(selectedAsset.type)} / ${display(selectedAsset.status)}` : ''}</SheetDescription>
          </SheetHeader>
          {selectedAsset && (
            <div className="space-y-3 overflow-y-auto p-4">
              {[
                ['资产编号', selectedAsset.id],
                ['所属部门', selectedAsset.department],
                ['使用人', selectedAsset.user],
                ['购入日期', selectedAsset.purchase_date],
                ['资产价值', `￥${formatMoney(selectedAsset.value)}`],
                ['领用时间', selectedAsset.claim_time],
                ['报废时间', selectedAsset.scrap_time],
                ['报废确认人', selectedAsset.scrap_confirmer],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="max-w-[60%] truncate font-medium text-slate-950">{display(value)}</span>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" className="rounded-2xl" onClick={() => openEdit(selectedAsset)}>修改</Button>
                <Button variant="outline" className="rounded-2xl border-red-200 text-red-600" onClick={() => void deleteAsset(selectedAsset)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[86dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editingAsset ? '修改资产' : '新增资产'}</DialogTitle>
            <DialogDescription>手机端填写基础资产信息。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>资产名称</Label>
              <Input value={assetForm.name} onChange={(event) => setAssetForm((current) => ({ ...current, name: event.target.value }))} className="h-12 rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>资产类型</Label>
              <select value={assetForm.type} onChange={(event) => setAssetForm((current) => ({ ...current, type: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base">
                {assetTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>部门</Label>
                <Input value={assetForm.department} onChange={(event) => setAssetForm((current) => ({ ...current, department: event.target.value }))} className="h-12 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Label>使用人</Label>
                <Input value={assetForm.user} onChange={(event) => setAssetForm((current) => ({ ...current, user: event.target.value }))} className="h-12 rounded-2xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>价值</Label>
                <Input value={assetForm.value} onChange={(event) => setAssetForm((current) => ({ ...current, value: event.target.value }))} className="h-12 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Label>购入日期</Label>
                <Input type="date" value={assetForm.purchase_date} onChange={(event) => setAssetForm((current) => ({ ...current, purchase_date: event.target.value }))} className="h-12 rounded-2xl" />
              </div>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="rounded-2xl" onClick={() => setFormOpen(false)} disabled={saving}>取消</Button>
            <Button className="rounded-2xl bg-blue-600" onClick={submitAsset} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-h-[86dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>一键生成资产</DialogTitle>
            <DialogDescription>按前缀和起始编号批量创建资产。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>类型</Label>
                <Input value={bulkForm.type} onChange={(event) => setBulkForm((current) => ({ ...current, type: event.target.value }))} className="h-12 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Label>名称前缀</Label>
                <Input value={bulkForm.namePrefix} onChange={(event) => setBulkForm((current) => ({ ...current, namePrefix: event.target.value }))} className="h-12 rounded-2xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>数量</Label>
                <Input value={bulkForm.count} onChange={(event) => setBulkForm((current) => ({ ...current, count: event.target.value }))} className="h-12 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Label>起始编号</Label>
                <Input value={bulkForm.startNumber} onChange={(event) => setBulkForm((current) => ({ ...current, startNumber: event.target.value }))} className="h-12 rounded-2xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>部门</Label>
              <Input value={bulkForm.department} onChange={(event) => setBulkForm((current) => ({ ...current, department: event.target.value }))} className="h-12 rounded-2xl" />
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="rounded-2xl" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>取消</Button>
            <Button className="rounded-2xl bg-blue-600" onClick={submitBulkGenerate} disabled={bulkSaving}>
              {bulkSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] rounded-3xl">
          <DialogHeader>
            <DialogTitle>资产二维码</DialogTitle>
            <DialogDescription>扫码查看资产详情。</DialogDescription>
          </DialogHeader>
          {qrData && (
            <div className="space-y-3 text-center">
              <img src={qrData.qrCode} alt="资产二维码" className="mx-auto h-56 w-56 rounded-2xl border border-slate-200 p-2" />
              <div className="break-all rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">{qrData.url}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
