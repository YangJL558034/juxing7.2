'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Building,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCcw,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface Employee {
  id: number;
  name: string;
  phone: string;
  id_card?: string;
  department: string;
  position?: string;
  location?: string;
  status?: string;
  hire_date?: string;
  resign_date?: string;
  created_at: string;
}

interface MonthlyRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  year: number;
  month: string;
  month_num: number;
  department: string;
  location?: string;
  normal_hours: number;
  weekday_overtime: number;
  weekend_overtime: number;
  base_salary: number;
  total_payable: number;
  deduction: number;
  actual_amount: number;
  signature?: string;
  sign_time?: string;
  signature_time?: string;
  bank_account?: string;
  remark?: string;
  created_at: string;
}

function normalizeLocation(value?: string | null): 'office' | 'workshop' {
  const text = String(value || '').trim().toLowerCase();
  return text === 'workshop' || text === '车间' ? 'workshop' : 'office';
}

function display(value?: string | number | null) {
  if (value === undefined || value === null) return '-';
  const text = String(value).trim();
  return text || '-';
}

function money(value?: number | string | null) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '￥0';
  return `￥${numeric.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

function maskPhone(value?: string | null) {
  const phone = String(value || '').trim();
  if (phone.length < 7) return display(phone);
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function isResignedEmployee(status?: string | null) {
  return String(status || '').includes('离职');
}

function currentYear() {
  return String(new Date().getFullYear());
}

function currentMonth() {
  return String(new Date().getMonth() + 1).padStart(2, '0');
}

export default function MobileSalaryPage() {
  const [mode, setMode] = useState<'employees' | 'salary'>('salary');
  const [location, setLocation] = useState<'office' | 'workshop'>('office');
  const [query, setQuery] = useState('');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<MonthlyRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeDetailOpen, setEmployeeDetailOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [employeeRes, salaryRes] = await Promise.all([
        fetch('/api/employees', { cache: 'no-store' }),
        fetch(`/api/work-hours-monthly?year=${year}&month=${Number(month)}`, { cache: 'no-store' }),
      ]);
      const employeeData = await employeeRes.json().catch(() => ({}));
      const salaryData = await salaryRes.json().catch(() => ({}));
      if (!employeeRes.ok || !employeeData.success) throw new Error(employeeData.error || '获取员工失败');
      if (!salaryRes.ok || !salaryData.success) throw new Error(salaryData.error || '获取工资失败');
      setEmployees(employeeData.data || []);
      setRecords(salaryData.data || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取工资工时失败');
      setEmployees([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [year, month]);

  const filteredEmployees = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesLocation = normalizeLocation(employee.location) === location;
      const matchesKeyword = !keyword || `${employee.name} ${employee.phone} ${employee.id_card} ${employee.department}`.toLowerCase().includes(keyword);
      return matchesLocation && matchesKeyword;
    });
  }, [employees, location, query]);

  const activeEmployees = useMemo(() => {
    return filteredEmployees.filter((employee) => !isResignedEmployee(employee.status));
  }, [filteredEmployees]);

  const resignedEmployees = useMemo(() => {
    return filteredEmployees.filter((employee) => isResignedEmployee(employee.status));
  }, [filteredEmployees]);

  const filteredRecords = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesLocation = normalizeLocation(record.location) === location;
      const matchesKeyword = !keyword || `${record.employee_name} ${record.department} ${record.bank_account}`.toLowerCase().includes(keyword);
      return matchesLocation && matchesKeyword;
    });
  }, [location, query, records]);

  const salaryTotal = filteredRecords.reduce((sum, record) => sum + Number(record.actual_amount || 0), 0);
  const signedTotal = filteredRecords.filter((record) => Boolean(record.signature)).length;

  return (
    <div className="space-y-4">
      <section className="mobile-ios-glass rounded-[30px] p-5 text-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-blue-600">工资工时</p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal">移动查询</h1>
            <p className="mt-2 text-sm text-slate-600">办公室和车间分开核对，按月份查看工资。</p>
          </div>
          <Button size="icon" variant="secondary" className="h-11 w-11 rounded-2xl border border-white/70 bg-white/[0.58] text-blue-700 shadow-sm backdrop-blur-xl hover:bg-white/75" onClick={() => void loadData()} disabled={loading}>
            <RefreshCcw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </Button>
        </div>

        {mode === 'employees' ? (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold">{filteredEmployees.length}</div>
              <div className="mt-1 text-xs text-slate-500">员工总数</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold text-emerald-700">{activeEmployees.length}</div>
              <div className="mt-1 text-xs text-slate-500">在职</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold text-slate-700">{resignedEmployees.length}</div>
              <div className="mt-1 text-xs text-slate-500">已离职</div>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold">{filteredRecords.length}</div>
              <div className="mt-1 text-xs text-slate-500">工资条</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="text-xl font-bold">{signedTotal}</div>
              <div className="mt-1 text-xs text-slate-500">已签字</div>
            </div>
            <div className="mobile-ios-tile rounded-2xl p-3">
              <div className="truncate text-xl font-bold">{money(salaryTotal)}</div>
              <div className="mt-1 text-xs text-slate-500">实发合计</div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('salary')}
            className={cn('rounded-2xl px-4 py-3 text-sm font-semibold', mode === 'salary' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}
          >
            工资
          </button>
          <button
            type="button"
            onClick={() => setMode('employees')}
            className={cn('rounded-2xl px-4 py-3 text-sm font-semibold', mode === 'employees' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}
          >
            员工
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLocation('office')}
            className={cn('rounded-2xl px-4 py-3 text-sm font-semibold', location === 'office' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600')}
          >
            办公室
          </button>
          <button
            type="button"
            onClick={() => setLocation('workshop')}
            className={cn('rounded-2xl px-4 py-3 text-sm font-semibold', location === 'workshop' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600')}
          >
            车间
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Input value={year} onChange={(event) => setYear(event.target.value)} placeholder="年份" className="h-12 rounded-2xl text-base" />
          <Input value={month} onChange={(event) => setMonth(event.target.value.padStart(2, '0'))} placeholder="月份" className="h-12 rounded-2xl text-base" />
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、手机、部门" className="h-12 rounded-2xl bg-slate-50 pl-9 text-base" />
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-slate-950">{mode === 'salary' ? '工资列表' : '员工列表'}</h2>
          <span className="text-sm text-slate-500">{mode === 'salary' ? filteredRecords.length : filteredEmployees.length} 条</span>
        </div>

        {loading && (
          <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" />
            正在加载
          </div>
        )}

        {!loading && mode === 'employees' && (
          <>
            {[
              { title: '在职员工', items: activeEmployees, tone: 'text-emerald-700' },
              { title: '已离职员工', items: resignedEmployees, tone: 'text-slate-700' },
            ].map((group) => (
              <div key={group.title} className="space-y-2">
                <div className="flex items-center justify-between px-1 pt-1">
                  <h3 className="text-sm font-semibold text-slate-900">{group.title}</h3>
                  <span className={cn('text-sm font-semibold', group.tone)}>{group.items.length} 人</span>
                </div>
                {group.items.map((employee) => (
                  <article
                    key={employee.id}
                    className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition active:scale-[0.99]"
                    onClick={() => {
                      setSelectedEmployee(employee);
                      setEmployeeDetailOpen(true);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <UserRound className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-semibold text-slate-950">{employee.name}</h3>
                        <p className="mt-1 truncate text-sm text-slate-500">{display(employee.department)} / {display(employee.position)}</p>
                      </div>
                      <span className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                        isResignedEmployee(employee.status)
                          ? 'bg-slate-100 text-slate-700 ring-slate-200'
                          : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                      )}>
                        {display(employee.status || '在职')}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-400">手机号</div>
                        <div className="mt-1 font-medium text-slate-900">{maskPhone(employee.phone)}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <div className="text-xs text-slate-400">{isResignedEmployee(employee.status) ? '离职日期' : '入职日期'}</div>
                        <div className="mt-1 font-medium text-slate-900">{display(isResignedEmployee(employee.status) ? employee.resign_date : employee.hire_date)}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-right text-xs font-medium text-blue-600">点击查看员工详细</div>
                  </article>
                ))}
              </div>
            ))}
          </>
        )}

        {!loading && mode === 'salary' && filteredRecords.map((record) => (
          <article key={record.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm" onClick={() => { setSelectedRecord(record); setDetailOpen(true); }}>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Banknote className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-semibold text-slate-950">{record.employee_name}</h3>
                  {record.signature ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">已签字</span>
                  ) : (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">未签字</span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{record.year}年{record.month_num}月 / {display(record.department)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">应发</div>
                <div className="mt-1 font-semibold text-slate-900">{money(record.total_payable)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">扣款</div>
                <div className="mt-1 font-semibold text-slate-900">{money(record.deduction)}</div>
              </div>
              <div className="rounded-2xl bg-blue-50 p-3">
                <div className="text-xs text-blue-500">实发</div>
                <div className="mt-1 font-semibold text-blue-700">{money(record.actual_amount)}</div>
              </div>
            </div>
          </article>
        ))}

        {!loading && ((mode === 'salary' && filteredRecords.length === 0) || (mode === 'employees' && filteredEmployees.length === 0)) && (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">暂无数据</div>
        )}
      </section>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="max-h-[86dvh] rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>{selectedRecord?.employee_name || '工资明细'}</SheetTitle>
            <SheetDescription>{selectedRecord ? `${selectedRecord.year}年${selectedRecord.month_num}月工资` : ''}</SheetDescription>
          </SheetHeader>
          {selectedRecord && (
            <div className="space-y-3 overflow-y-auto p-4">
              {[
                ['位置', normalizeLocation(selectedRecord.location) === 'office' ? '办公室' : '车间'],
                ['部门', selectedRecord.department],
                ['底薪', money(selectedRecord.base_salary)],
                ['正常工时', `${selectedRecord.normal_hours || 0}`],
                ['平时加班', `${selectedRecord.weekday_overtime || 0}`],
                ['周末加班', `${selectedRecord.weekend_overtime || 0}`],
                ['应发工资', money(selectedRecord.total_payable)],
                ['扣款', money(selectedRecord.deduction)],
                ['实发工资', money(selectedRecord.actual_amount)],
                ['签字状态', selectedRecord.signature ? '已签字' : '未签字'],
                ['签字时间', selectedRecord.sign_time || selectedRecord.signature_time],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-500">
                    {label === '位置' ? <Building className="h-4 w-4" /> : label === '签字状态' ? <CheckCircle2 className="h-4 w-4" /> : label === '正常工时' ? <Clock className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                    {label}
                  </span>
                  <span className="max-w-[55%] truncate font-medium text-slate-950">{display(value)}</span>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={employeeDetailOpen} onOpenChange={setEmployeeDetailOpen}>
        <SheetContent side="bottom" className="max-h-[86dvh] rounded-t-[26px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>{selectedEmployee?.name || '员工详细'}</SheetTitle>
            <SheetDescription>{selectedEmployee ? `${display(selectedEmployee.department)} / ${display(selectedEmployee.position)}` : ''}</SheetDescription>
          </SheetHeader>
          {selectedEmployee && (
            <div className="space-y-3 overflow-y-auto p-4">
              {[
                ['姓名', selectedEmployee.name],
                ['状态', selectedEmployee.status || '在职'],
                ['位置', normalizeLocation(selectedEmployee.location) === 'office' ? '办公室' : '车间'],
                ['部门', selectedEmployee.department],
                ['岗位', selectedEmployee.position],
                ['手机号', selectedEmployee.phone],
                ['身份证号', selectedEmployee.id_card],
                ['入职日期', selectedEmployee.hire_date],
                ['离职日期', selectedEmployee.resign_date],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="shrink-0 text-slate-500">{label}</span>
                  <span className="min-w-0 break-all text-right font-medium text-slate-950">{display(value)}</span>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
