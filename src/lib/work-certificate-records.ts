import { chinaToday } from '@/lib/china-time';
import type { WorkCertificateFormData, WorkCertificateRecord, WorkCertificateStatus } from '@/types/work-certificate';

export interface WorkCertificateDbRow {
  id: number;
  status: WorkCertificateStatus;
  name: string;
  gender: string | null;
  id_card: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  hire_date: string | null;
  purpose: string | null;
  data_json: string;
  reviewer_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export const defaultWorkCertificateData: WorkCertificateFormData = {
  name: '',
  gender: '',
  idCard: '',
  phone: '',
  department: '',
  position: '',
  hireDate: '',
  purpose: '办理银行卡',
  companyName: '东莞山泽新能源科技有限公司',
  issueDate: '',
  reviewerName: '',
  reviewRemark: '',
};

export function createDefaultWorkCertificateData(): WorkCertificateFormData {
  return {
    ...defaultWorkCertificateData,
    issueDate: chinaToday(),
  };
}

export function normalizeWorkCertificateData(value: unknown): WorkCertificateFormData {
  const data = typeof value === 'object' && value ? value as Partial<WorkCertificateFormData> : {};
  const merged = { ...createDefaultWorkCertificateData(), ...data };
  return {
    ...merged,
    name: String(merged.name || '').trim(),
    gender: merged.gender === '女' ? '女' : merged.gender === '男' ? '男' : '',
    idCard: String(merged.idCard || '').trim(),
    phone: String(merged.phone || '').trim(),
    department: String(merged.department || '').trim(),
    position: String(merged.position || '').trim(),
    hireDate: String(merged.hireDate || '').trim(),
    purpose: String(merged.purpose || '').trim() || '办理银行卡',
    companyName: String(merged.companyName || '').trim() || '东莞山泽新能源科技有限公司',
    issueDate: String(merged.issueDate || '').trim(),
    reviewerName: String(merged.reviewerName || '').trim(),
    reviewRemark: String(merged.reviewRemark || '').trim(),
  };
}

export function parseWorkCertificateRow(row: WorkCertificateDbRow): WorkCertificateRecord {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(row.data_json || '{}');
  } catch {
    parsed = {};
  }

  const data = normalizeWorkCertificateData(parsed);
  return {
    id: row.id,
    status: row.status === '已审核' ? '已审核' : '待审核',
    data,
    name: row.name || data.name,
    gender: row.gender || data.gender,
    idCard: row.id_card || data.idCard,
    phone: row.phone || data.phone,
    department: row.department || data.department,
    position: row.position || data.position,
    hireDate: row.hire_date || data.hireDate,
    purpose: row.purpose || data.purpose,
    reviewerName: row.reviewer_name,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    restoreUntil: row.deleted_at ? addSevenDays(row.deleted_at) : null,
  };
}

function addSevenDays(value: string): string {
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  parsed.setDate(parsed.getDate() + 7);
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
}
