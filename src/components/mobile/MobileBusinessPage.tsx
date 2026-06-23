'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import {
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  Contact,
  DollarSign,
  FileText,
  Loader2,
  Package,
  Receipt,
  RefreshCcw,
  Search,
  Share2,
  UserCog,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

type MobileBusinessKey =
  | 'taskmanage'
  | 'distribution'
  | 'todo'
  | 'leads'
  | 'customers'
  | 'contacts'
  | 'contracts'
  | 'invoices'
  | 'followup'
  | 'products'
  | 'finance'
  | 'tasks'
  | 'generate'
  | 'organization'
  | 'human-resources'
  | 'permission'
  | 'purchase-requests'
  | 'expense-claims'
  | 'approval-center'
  | 'finance-review'
  | 'usermanage'
  | 'smtp'
  | 'notification-center'
  | 'operation-logs';

type AnyRecord = Record<string, unknown>;

const hiddenDetailFields = new Set([
  'success',
  'error',
  'message',
  'data',
  'password',
  'auth_token',
  'token',
  'proof_file',
  'signature',
]);

const fieldLabels: Record<string, string> = {
  id: '编号',
  name: '名称',
  title: '标题',
  code: '编码',
  username: '用户名',
  user_name: '用户',
  phone: '手机号',
  email: '邮箱',
  host: '服务器',
  port: '端口',
  secure: '安全连接',
  enabled: '启用',
  user: '账号',
  from_name: '发件名称',
  from_email: '发件邮箱',
  module: '模块',
  action: '操作',
  details: '详情',
  description: '说明',
  content: '内容',
  type: '类型',
  category: '分类',
  status: '状态',
  level: '级别',
  source: '来源',
  address: '地址',
  owner: '负责人',
  department: '部门',
  position: '岗位',
  role: '角色',
  remark: '备注',
  amount: '金额',
  total_amount: '总金额',
  price: '价格',
  stock: '库存',
  date: '日期',
  created_at: '创建时间',
  updated_at: '更新时间',
  issue_date: '开票日期',
  end_date: '截止日期',
  applicant_name: '申请人',
  current_approver_name: '当前审批人',
  customer_name: '客户名称',
  contract_no: '合同编号',
  invoice_no: '发票编号',
  request_no: '请购单号',
  claim_no: '报销单号',
};

interface BusinessConfig {
  title: string;
  eyebrow: string;
  desc: string;
  endpoint: string;
  arrayKeys: string[];
  primary: string[];
  secondary: string[];
  meta: Array<{ label: string; field: string }>;
  statusFields?: string[];
  amountFields?: string[];
  icon: ElementType;
  query?: string;
}

const configs: Record<MobileBusinessKey, BusinessConfig> = {
  taskmanage: {
    title: '任务管理',
    eyebrow: '系统管理',
    desc: '查看后台任务、状态和处理进度。',
    endpoint: '/api/tasks',
    arrayKeys: ['data', 'tasks'],
    primary: ['name', 'title'],
    secondary: ['type', 'remark', 'description'],
    meta: [{ label: '负责人', field: 'owner' }, { label: '截止', field: 'end_date' }],
    statusFields: ['status', 'priority'],
    icon: ClipboardList,
  },
  distribution: {
    title: '分销达人',
    eyebrow: '系统管理',
    desc: '移动端查看分销人员、归属和联系方式。',
    endpoint: '/api/distributors',
    arrayKeys: ['data', 'distributors'],
    primary: ['name', 'username'],
    secondary: ['phone', 'remark'],
    meta: [{ label: '等级', field: 'level' }, { label: '部门', field: 'department' }],
    statusFields: ['status'],
    icon: Share2,
  },
  todo: {
    title: '待办事项',
    eyebrow: '系统管理',
    desc: '按 App 卡片查看待联系、待处理事项。',
    endpoint: '/api/todos',
    arrayKeys: ['data', 'todos'],
    primary: ['name', 'title'],
    secondary: ['category', 'remark', 'phone'],
    meta: [{ label: '负责人', field: 'owner' }, { label: '来源', field: 'source' }],
    statusFields: ['status', 'processed'],
    icon: CheckCircle2,
  },
  leads: {
    title: '线索管理',
    eyebrow: '客户管理',
    desc: '查看线索来源、客户级别和负责人。',
    endpoint: '/api/leads',
    arrayKeys: ['data', 'leads'],
    primary: ['name'],
    secondary: ['industry', 'phone', 'remark'],
    meta: [{ label: '级别', field: 'level' }, { label: '负责人', field: 'owner' }],
    statusFields: ['status', 'level'],
    icon: Users,
  },
  customers: {
    title: '客户管理',
    eyebrow: '客户管理',
    desc: '移动端查看客户档案、状态和联系信息。',
    endpoint: '/api/customers',
    arrayKeys: ['data', 'customers'],
    primary: ['name', 'customer_name'],
    secondary: ['phone', 'address'],
    meta: [{ label: '级别', field: 'level' }, { label: '负责人', field: 'owner' }],
    statusFields: ['status', 'level'],
    icon: Building2,
  },
  contacts: {
    title: '联系人',
    eyebrow: '客户管理',
    desc: '查看客户联系人、电话和邮箱。',
    endpoint: '/api/contacts',
    arrayKeys: ['contacts', 'data'],
    primary: ['name'],
    secondary: ['phone', 'email', 'position'],
    meta: [{ label: '职位', field: 'position' }, { label: '客户', field: 'customer_name' }],
    statusFields: ['is_primary'],
    icon: Contact,
  },
  contracts: {
    title: '合同',
    eyebrow: '业务管理',
    desc: '移动端查看合同金额、客户和签署状态。',
    endpoint: '/api/contracts',
    arrayKeys: ['contracts', 'data'],
    primary: ['name', 'contract_no'],
    secondary: ['customer_name', 'remark'],
    meta: [{ label: '金额', field: 'amount' }, { label: '负责人', field: 'owner' }],
    statusFields: ['status'],
    amountFields: ['amount'],
    icon: FileText,
  },
  invoices: {
    title: '发票',
    eyebrow: '业务管理',
    desc: '查看发票号码、金额和开票状态。',
    endpoint: '/api/invoices',
    arrayKeys: ['invoices', 'data'],
    primary: ['invoice_no', 'customer_name'],
    secondary: ['type', 'remark'],
    meta: [{ label: '金额', field: 'amount' }, { label: '日期', field: 'issue_date' }],
    statusFields: ['status'],
    amountFields: ['amount', 'tax_amount'],
    icon: Receipt,
  },
  followup: {
    title: '跟进记录',
    eyebrow: '业务管理',
    desc: '查看客户跟进、拜访和记录内容。',
    endpoint: '/api/visits',
    arrayKeys: ['data', 'visits'],
    primary: ['customer_name', 'title', 'name'],
    secondary: ['content', 'remark'],
    meta: [{ label: '跟进人', field: 'owner' }, { label: '时间', field: 'visit_time' }],
    statusFields: ['status'],
    icon: Briefcase,
  },
  products: {
    title: '产品',
    eyebrow: '业务管理',
    desc: '查看产品分类、库存和销售状态。',
    endpoint: '/api/products',
    arrayKeys: ['products', 'data'],
    primary: ['name'],
    secondary: ['category', 'remark'],
    meta: [{ label: '价格', field: 'price' }, { label: '库存', field: 'stock' }],
    statusFields: ['status'],
    amountFields: ['price'],
    icon: Package,
  },
  finance: {
    title: '财务明细',
    eyebrow: '财务管理',
    desc: '按 App 卡片查看收入、支出和净额。',
    endpoint: '/api/finances',
    arrayKeys: ['finances', 'data'],
    primary: ['category', 'type', 'remark'],
    secondary: ['department', 'owner', 'remark'],
    meta: [{ label: '金额', field: 'amount' }, { label: '日期', field: 'date' }],
    statusFields: ['type'],
    amountFields: ['amount'],
    icon: DollarSign,
  },
  tasks: {
    title: '任务列表',
    eyebrow: '系统管理',
    desc: '查看任务负责人、优先级和截止日期。',
    endpoint: '/api/tasks',
    arrayKeys: ['data', 'tasks'],
    primary: ['name', 'title'],
    secondary: ['type', 'remark'],
    meta: [{ label: '负责人', field: 'owner' }, { label: '截止', field: 'end_date' }],
    statusFields: ['status', 'priority'],
    icon: ClipboardList,
  },
  generate: {
    title: '智能生成',
    eyebrow: 'AI 工具',
    desc: '查看生成记录和智能工具数据。',
    endpoint: '/api/registration-codes',
    arrayKeys: ['data', 'codes', 'records'],
    primary: ['code', 'name', 'title'],
    secondary: ['remark', 'status'],
    meta: [{ label: '状态', field: 'status' }, { label: '时间', field: 'created_at' }],
    statusFields: ['status'],
    icon: Package,
  },
  organization: {
    title: '组织架构',
    eyebrow: '组织人事',
    desc: '查看部门、岗位和组织基础资料。',
    endpoint: '/api/departments',
    arrayKeys: ['data', 'departments'],
    primary: ['name'],
    secondary: ['description', 'remark'],
    meta: [{ label: '负责人', field: 'manager' }, { label: '创建', field: 'created_at' }],
    statusFields: ['status'],
    icon: Building2,
  },
  'human-resources': {
    title: '人力资源',
    eyebrow: '组织人事',
    desc: '查看员工基础资料和人员状态。',
    endpoint: '/api/employees',
    arrayKeys: ['data', 'employees'],
    primary: ['name'],
    secondary: ['department', 'phone'],
    meta: [{ label: '岗位', field: 'position' }, { label: '状态', field: 'status' }],
    statusFields: ['status'],
    icon: Users,
  },
  permission: {
    title: '权限管理',
    eyebrow: '组织人事',
    desc: '移动端查看权限配置记录。',
    endpoint: '/api/permissions',
    arrayKeys: ['data', 'permissions'],
    primary: ['module_name', 'name', 'module'],
    secondary: ['description', 'permission'],
    meta: [{ label: '权限', field: 'permission' }, { label: '角色', field: 'role' }],
    statusFields: ['status'],
    icon: UserCog,
  },
  'purchase-requests': {
    title: '请购单管理',
    eyebrow: '审批流程',
    desc: '查看请购单金额、申请人和审批状态。',
    endpoint: '/api/purchase-requests',
    arrayKeys: ['requests', 'data'],
    primary: ['title', 'request_no'],
    secondary: ['reason', 'applicant_name'],
    meta: [{ label: '金额', field: 'total_amount' }, { label: '申请人', field: 'applicant_name' }],
    statusFields: ['status', 'urgency'],
    amountFields: ['total_amount'],
    icon: ClipboardList,
  },
  'expense-claims': {
    title: '费用报销',
    eyebrow: '审批流程',
    desc: '查看费用报销金额、类型和审批状态。',
    endpoint: '/api/expense-claims',
    arrayKeys: ['claims', 'data'],
    primary: ['title', 'claim_no'],
    secondary: ['expense_type', 'description'],
    meta: [{ label: '金额', field: 'total_amount' }, { label: '申请人', field: 'applicant_name' }],
    statusFields: ['status', 'expense_type'],
    amountFields: ['total_amount'],
    icon: DollarSign,
  },
  'approval-center': {
    title: '审批中心',
    eyebrow: '审批流程',
    desc: '汇总待审批请购单和费用报销。',
    endpoint: '/api/purchase-requests',
    query: 'approval=true',
    arrayKeys: ['requests', 'data'],
    primary: ['title', 'request_no'],
    secondary: ['reason', 'applicant_name'],
    meta: [{ label: '金额', field: 'total_amount' }, { label: '当前审批', field: 'current_approver_name' }],
    statusFields: ['status'],
    amountFields: ['total_amount'],
    icon: CheckCircle2,
  },
  'finance-review': {
    title: '财务终审',
    eyebrow: '审批流程',
    desc: '查看进入财务终审的单据。',
    endpoint: '/api/expense-claims',
    query: 'approval=true',
    arrayKeys: ['claims', 'data'],
    primary: ['title', 'claim_no'],
    secondary: ['expense_type', 'description'],
    meta: [{ label: '金额', field: 'total_amount' }, { label: '当前审批', field: 'current_approver_name' }],
    statusFields: ['status'],
    amountFields: ['total_amount'],
    icon: DollarSign,
  },
  usermanage: {
    title: '用户管理',
    eyebrow: '系统管理',
    desc: '移动端查看系统用户、角色和部门。',
    endpoint: '/api/users',
    arrayKeys: ['data', 'users'],
    primary: ['name', 'username'],
    secondary: ['username', 'department'],
    meta: [{ label: '角色', field: 'role' }, { label: '部门', field: 'department' }],
    statusFields: ['status', 'role'],
    icon: UserCog,
  },
  smtp: {
    title: '邮件服务器',
    eyebrow: '系统管理',
    desc: '查看 SMTP 配置状态和服务器参数。',
    endpoint: '/api/smtp-config',
    arrayKeys: ['configs', 'data'],
    primary: ['host', 'from_email', 'user'],
    secondary: ['from_name', 'user'],
    meta: [{ label: '端口', field: 'port' }, { label: '启用', field: 'enabled' }],
    statusFields: ['enabled', 'secure'],
    icon: Bell,
  },
  'notification-center': {
    title: '通知中心',
    eyebrow: '消息提醒',
    desc: '查看系统通知、审批提醒和发送状态。',
    endpoint: '/api/notifications/list',
    arrayKeys: ['notifications', 'data'],
    primary: ['title'],
    secondary: ['content', 'receiver_name'],
    meta: [{ label: '接收人', field: 'receiver_name' }, { label: '时间', field: 'created_at' }],
    statusFields: ['type', 'email_sent'],
    icon: Bell,
  },
  'operation-logs': {
    title: '操作日志',
    eyebrow: '系统管理',
    desc: '按 App 卡片查看用户操作、模块和时间。',
    endpoint: '/api/operation-logs',
    query: 'page=1&pageSize=80',
    arrayKeys: ['logs', 'data.logs'],
    primary: ['details', 'description', 'action'],
    secondary: ['module', 'user_name'],
    meta: [{ label: '用户', field: 'user_name' }, { label: '时间', field: 'created_at' }],
    statusFields: ['module', 'action'],
    icon: FileText,
  },
};

function valueOf(record: AnyRecord, fields: string[]) {
  for (const field of fields) {
    const value = record[field];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function getByPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') return (current as AnyRecord)[key];
    return undefined;
  }, value);
}

function extractRows(payload: unknown, keys: string[]) {
  if (Array.isArray(payload)) return payload as AnyRecord[];
  for (const key of keys) {
    const value = getByPath(payload, key);
    if (Array.isArray(value)) return value as AnyRecord[];
    if (value && typeof value === 'object') return [value as AnyRecord];
  }
  const data = getByPath(payload, 'data');
  if (Array.isArray(data)) return data as AnyRecord[];
  if (data && typeof data === 'object') return [data as AnyRecord];
  if (data === null) return [];
  if (payload && typeof payload === 'object') {
    const record = payload as AnyRecord;
    const hasBusinessField = Object.keys(record).some((key) => !hiddenDetailFields.has(key));
    if (hasBusinessField) return [record];
  }
  return [];
}

function formatText(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return `${value.length} 条记录`;
  if (typeof value === 'object') {
    return '已填写';
  }
  return String(value);
}

function formatMoney(value: unknown) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '¥0';
  return `¥${numeric.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

function isAmountField(field: string) {
  return /(amount|price|fee|total|salary|money|收入|支出|金额)/i.test(field);
}

function statusTone(value: unknown) {
  const text = formatText(value);
  if (/驳回|失败|拒绝|删除|报废|支出/.test(text)) return 'bg-red-50 text-red-700 ring-red-200';
  if (/待|进行|未|草稿/.test(text)) return 'bg-orange-50 text-orange-700 ring-orange-200';
  if (/已|完成|通过|成功|在职|收入|启用/.test(text)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  return 'bg-blue-50 text-blue-700 ring-blue-200';
}

function detailEntries(record: AnyRecord) {
  return Object.entries(record)
    .filter(([field, value]) => !hiddenDetailFields.has(field) && value !== undefined && value !== null && value !== '')
    .slice(0, 28);
}

function labelFor(field: string) {
  return fieldLabels[field] || field.replace(/_/g, ' ');
}

export default function MobileBusinessPage({ moduleKey }: { moduleKey: MobileBusinessKey }) {
  const config = configs[moduleKey];
  const Icon = config.icon;
  const [records, setRecords] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AnyRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers: HeadersInit = {};
      const token = window.localStorage.getItem('token');
      if (token) headers.Authorization = `Bearer ${token}`;
      const joiner = config.endpoint.includes('?') ? '&' : '?';
      const url = config.query ? `${config.endpoint}${joiner}${config.query}` : config.endpoint;
      const response = await fetch(url, { cache: 'no-store', credentials: 'include', headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '获取数据失败');
      setRecords(extractRows(data, config.arrayKeys));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取数据失败');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return records;
    return records.filter((record) => JSON.stringify(record).toLowerCase().includes(keyword));
  }, [query, records]);

  const pendingCount = records.filter((record) => {
    const text = config.statusFields?.map((field) => formatText(record[field])).join(' ') || '';
    return /待|进行|未|草稿/.test(text);
  }).length;
  const doneCount = records.filter((record) => {
    const text = config.statusFields?.map((field) => formatText(record[field])).join(' ') || '';
    return /已|完成|通过|成功|在职|启用/.test(text);
  }).length;
  const amountTotal = (config.amountFields || []).reduce((sum, field) => {
    return sum + records.reduce((inner, record) => inner + Number(record[field] || 0), 0);
  }, 0);

  return (
    <div className="space-y-4">
      <section className="mobile-ios-glass rounded-[30px] p-5 text-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-blue-600">{config.eyebrow}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal">{config.title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{config.desc}</p>
          </div>
          <Button size="icon" variant="secondary" className="h-11 w-11 rounded-2xl border border-white/70 bg-white/[0.58] text-blue-700 shadow-sm backdrop-blur-xl hover:bg-white/75" onClick={() => void loadRecords()} disabled={loading}>
            <RefreshCcw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="mobile-ios-tile rounded-2xl p-3">
            <div className="text-xl font-bold">{records.length}</div>
            <div className="mt-1 text-xs text-slate-500">总数</div>
          </div>
          <div className="mobile-ios-tile rounded-2xl p-3">
            <div className="text-xl font-bold">{pendingCount}</div>
            <div className="mt-1 text-xs text-slate-500">待处理</div>
          </div>
          <div className="mobile-ios-tile rounded-2xl p-3">
            <div className="truncate text-xl font-bold">{config.amountFields?.length ? formatMoney(amountTotal) : doneCount}</div>
            <div className="mt-1 text-xs text-slate-500">{config.amountFields?.length ? '合计' : '已处理'}</div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/70 bg-white/[0.9] p-3 shadow-sm backdrop-blur-xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${config.title}`} className="h-11 rounded-2xl bg-slate-50 pl-9 text-base" />
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading && (
        <div className="rounded-[24px] border border-white/70 bg-white/[0.9] p-8 text-center text-sm text-slate-500">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" />
          正在加载
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/[0.82] p-8 text-center text-sm text-slate-500">
          暂无数据
        </div>
      )}

      <section className="space-y-3">
        {!loading && filtered.map((record, index) => {
          const titleText = formatText(valueOf(record, config.primary));
          const title = titleText === '-' ? `${config.title} ${index + 1}` : titleText;
          const secondary = formatText(valueOf(record, config.secondary));
          const status = valueOf(record, config.statusFields || []);
          return (
            <article
              key={String(record.id || record.no || record.code || index)}
              className="rounded-[24px] border border-white/75 bg-white/[0.92] p-4 shadow-sm backdrop-blur-xl transition active:scale-[0.99]"
              onClick={() => {
                setSelected(record);
                setDetailOpen(true);
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-lg font-semibold text-slate-950">{title}</h3>
                    {status !== '' && (
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', statusTone(status))}>
                        {formatText(status)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{secondary}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {config.meta.map((item) => (
                  <div key={item.field} className="rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">{item.label}</div>
                    <div className="mt-1 truncate font-medium text-slate-900">
                      {isAmountField(item.field) ? formatMoney(record[item.field]) : formatText(record[item.field])}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="max-h-[86dvh] rounded-t-[28px] p-0">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>{selected ? formatText(valueOf(selected, config.primary)) : config.title}</SheetTitle>
            <SheetDescription>{selected ? formatText(valueOf(selected, config.secondary)) : '详细信息'}</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="space-y-2 overflow-y-auto p-4">
              {detailEntries(selected).map(([field, value]) => (
                <div key={field} className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="shrink-0 text-slate-500">{labelFor(field)}</span>
                  <span className="min-w-0 break-all text-right font-medium text-slate-950">
                    {isAmountField(field) ? formatMoney(value) : formatText(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export type { MobileBusinessKey };
