'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Droplets, Loader2, Plus, RefreshCcw, Save, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { WaterMeterRecord, WaterMeterRoomOption } from '@/types/water-meter';
import { chinaCurrentMonth, chinaToday } from '@/lib/china-time';
import { cn } from '@/lib/utils';

interface WaterMeterSummary {
  total: number;
  totalUsage: number;
  totalFee: number;
}

interface WaterMeterListResponse {
  success: boolean;
  records?: WaterMeterRecord[];
  summary?: WaterMeterSummary;
  error?: string;
}

interface WaterMeterRoomsResponse {
  success: boolean;
  rooms?: WaterMeterRoomOption[];
  error?: string;
}

interface WaterMeterCreateResponse {
  success: boolean;
  record?: WaterMeterRecord;
  error?: string;
  message?: string;
}

interface WaterMeterFormState {
  roomNo: string;
  readingDate: string;
  currentReading: string;
  unitPrice: string;
  recorderName: string;
  remark: string;
}

function createEmptyForm(): WaterMeterFormState {
  return {
    roomNo: '',
    readingDate: chinaToday(),
    currentReading: '',
    unitPrice: '',
    recorderName: '',
    remark: '',
  };
}

function display(value?: string | number | null) {
  if (value === undefined || value === null) return '-';
  const text = String(value).trim();
  return text || '-';
}

function money(value?: number | null) {
  if (value === undefined || value === null) return '-';
  return `¥${Number(value || 0).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
}

export default function MobileWaterMeterManager({ onBack }: { onBack: () => void }) {
  const [month, setMonth] = useState(chinaCurrentMonth());
  const [roomNo, setRoomNo] = useState('');
  const [records, setRecords] = useState<WaterMeterRecord[]>([]);
  const [rooms, setRooms] = useState<WaterMeterRoomOption[]>([]);
  const [summary, setSummary] = useState<WaterMeterSummary>({ total: 0, totalUsage: 0, totalFee: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WaterMeterFormState>(() => createEmptyForm());

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (month) params.set('month', month);
      if (roomNo.trim()) params.set('roomNo', roomNo.trim());
      const response = await fetch(`/api/water-meter?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as WaterMeterListResponse;
      if (!response.ok || !result.success) throw new Error(result.error || '获取水费记录失败');
      setRecords(result.records || []);
      setSummary(result.summary || { total: 0, totalUsage: 0, totalFee: 0 });
    } catch (loadError) {
      setRecords([]);
      setSummary({ total: 0, totalUsage: 0, totalFee: 0 });
      setError(loadError instanceof Error ? loadError.message : '获取水费记录失败');
    } finally {
      setLoading(false);
    }
  }, [month, roomNo]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const loadRooms = useCallback(async () => {
    try {
      const response = await fetch('/api/water-meter/rooms', { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as WaterMeterRoomsResponse;
      if (!response.ok || !result.success) throw new Error(result.error || '获取房号失败');
      setRooms(result.rooms || []);
    } catch (roomsError) {
      console.error('Load water meter rooms error:', roomsError);
      setRooms([]);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const groupedRecords = useMemo(() => {
    return records.reduce<Record<string, WaterMeterRecord[]>>((groups, record) => {
      const key = record.readingDate?.slice(0, 7) || '未登记月份';
      groups[key] = groups[key] || [];
      groups[key].push(record);
      return groups;
    }, {});
  }, [records]);

  const exportRecords = () => {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (roomNo.trim()) params.set('roomNo', roomNo.trim());
    window.open(`/api/water-meter/export?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const openCreateForm = () => {
    setForm({
      ...createEmptyForm(),
      roomNo: rooms[0]?.roomNo || '',
    });
    setFormOpen(true);
  };

  const updateForm = <K extends keyof WaterMeterFormState>(field: K, value: WaterMeterFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectedRoom = rooms.find((room) => room.roomNo === form.roomNo);

  const submitForm = async () => {
    if (!form.roomNo) {
      alert('请选择房号');
      return;
    }
    if (!form.readingDate) {
      alert('请选择登记日期');
      return;
    }
    if (!form.currentReading.trim()) {
      alert('请填写本次水表读数');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/water-meter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNo: form.roomNo,
          readingDate: form.readingDate,
          currentReading: form.currentReading.trim(),
          unitPrice: form.unitPrice.trim(),
          recorderName: form.recorderName.trim(),
          remark: form.remark.trim(),
        }),
      });
      const result = await response.json().catch(() => ({})) as WaterMeterCreateResponse;
      if (!response.ok || !result.success) throw new Error(result.error || '提交水表记录失败');
      setFormOpen(false);
      const targetMonth = form.readingDate.slice(0, 7);
      if (targetMonth && targetMonth !== month) {
        setMonth(targetMonth);
        await loadRooms();
      } else {
        await Promise.all([loadRecords(), loadRooms()]);
      }
    } catch (submitError) {
      alert(submitError instanceof Error ? submitError.message : '提交水表记录失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <section className="mobile-ios-glass rounded-[24px] p-4 text-slate-950">
        <div className="flex items-start gap-3">
          <Button type="button" size="icon" variant="secondary" className="h-9 w-9 rounded-2xl border border-white/70 bg-white/[0.58] text-blue-700 shadow-sm backdrop-blur-xl hover:bg-white/75" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">水费记录管理</h1>
            <p className="mt-1 text-xs leading-5 text-slate-600">查看移动端提交的水表记录，按月份筛选、登记和导出。</p>
          </div>
          <Button type="button" size="icon" variant="secondary" className="h-9 w-9 rounded-2xl border border-white/70 bg-white/[0.58] text-blue-700 shadow-sm backdrop-blur-xl hover:bg-white/75" onClick={() => void loadRecords()} disabled={loading}>
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="mobile-ios-tile rounded-2xl p-2.5">
            <div className="text-lg font-bold">{summary.total}</div>
            <div className="text-[11px] text-slate-500">记录</div>
          </div>
          <div className="mobile-ios-tile rounded-2xl p-2.5">
            <div className="text-lg font-bold">{summary.totalUsage || 0}</div>
            <div className="text-[11px] text-slate-500">用量</div>
          </div>
          <div className="mobile-ios-tile rounded-2xl p-2.5">
            <div className="text-lg font-bold">{money(summary.totalFee)}</div>
            <div className="text-[11px] text-slate-500">金额</div>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-white/70 bg-white/90 p-2.5 shadow-sm backdrop-blur">
        <div className="grid grid-cols-2 gap-2">
          <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-10 rounded-2xl text-sm" />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={roomNo} onChange={(event) => setRoomNo(event.target.value)} placeholder="房号" className="h-10 rounded-2xl pl-9 text-sm" />
          </div>
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <Button className="h-10 rounded-2xl bg-blue-600 text-sm shadow-lg shadow-blue-600/20" onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" />
            添加水表记录
          </Button>
          <Button size="icon" className="h-10 w-10 rounded-2xl bg-blue-600" onClick={exportRecords}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading && (
        <div className="rounded-[22px] border border-white/70 bg-white/90 p-6 text-center text-sm text-slate-500">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />
          正在加载
        </div>
      )}

      {!loading && records.length === 0 && (
        <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/80 p-6 text-center text-sm text-slate-500">
          暂无水费记录
        </div>
      )}

      {!loading && Object.entries(groupedRecords).map(([group, items]) => (
        <section key={group} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-950">{group}</h2>
            <span className="text-xs text-slate-500">{items.length} 条</span>
          </div>
          {items.map((record) => (
            <article key={record.id} className="rounded-[22px] border border-white/75 bg-white/[0.92] p-3 shadow-sm backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <Droplets className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="truncate text-base font-semibold text-slate-950">{record.roomNo}</h3>
                    <span className="text-sm font-semibold text-blue-600">{money(record.feeAmount)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(record.readingDate)} / 登记人 {display(record.recorderName)}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-2xl bg-slate-50 p-2.5">
                  <div className="text-slate-400">上次</div>
                  <div className="mt-1 font-medium text-slate-900">{display(record.previousReadingText)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-2.5">
                  <div className="text-slate-400">本次</div>
                  <div className="mt-1 font-medium text-slate-900">{display(record.currentReadingText)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-2.5">
                  <div className="text-slate-400">用量</div>
                  <div className="mt-1 font-medium text-slate-900">{display(record.usageAmount)}</div>
                </div>
              </div>
            </article>
          ))}
        </section>
      ))}

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-[30px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>水费登记</SheetTitle>
            <SheetDescription>在移动端直接添加水表记录，提交后同步到后台水费登记。</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 overflow-y-auto p-4">
            <div className="space-y-2">
              <Label>房号</Label>
              <select
                value={form.roomNo}
                onChange={(event) => updateForm('roomNo', event.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">请选择房号</option>
                {rooms.map((room) => (
                  <option key={room.roomNo} value={room.roomNo}>
                    {room.roomNo}
                  </option>
                ))}
              </select>
              {selectedRoom && (
                <p className="text-xs text-slate-500">
                  上次读数：{display(selectedRoom.latestReadingText)} / {formatDate(selectedRoom.latestReadingDate)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>登记日期</Label>
                <Input
                  type="date"
                  value={form.readingDate}
                  onChange={(event) => updateForm('readingDate', event.target.value)}
                  className="h-11 rounded-2xl text-base"
                />
              </div>
              <div className="space-y-2">
                <Label>本次读数</Label>
                <Input
                  inputMode="decimal"
                  value={form.currentReading}
                  onChange={(event) => updateForm('currentReading', event.target.value)}
                  placeholder="请输入"
                  className="h-11 rounded-2xl text-base"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>水费单价</Label>
                <Input
                  inputMode="decimal"
                  value={form.unitPrice}
                  onChange={(event) => updateForm('unitPrice', event.target.value)}
                  placeholder="可留空"
                  className="h-11 rounded-2xl text-base"
                />
              </div>
              <div className="space-y-2">
                <Label>登记人</Label>
                <Input
                  value={form.recorderName}
                  onChange={(event) => updateForm('recorderName', event.target.value)}
                  placeholder="可留空"
                  className="h-11 rounded-2xl text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={form.remark}
                onChange={(event) => updateForm('remark', event.target.value)}
                placeholder="可留空"
                className="min-h-20 rounded-2xl text-base"
              />
            </div>

            <Button className="mobile-submit-button h-12 w-full rounded-[22px] text-base font-semibold" onClick={submitForm} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              保存水表记录
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
