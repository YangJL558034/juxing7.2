import { chinaToday } from '@/lib/china-time';
import type { LaborContractTerminationFormData, LaborContractTerminationRecord } from '@/types/labor-contract-termination';

export interface LaborContractTerminationDbRow {
  id: number;
  employee_name: string;
  honorific: string | null;
  termination_date: string | null;
  reason: string | null;
  procedure_deadline: string | null;
  company_name: string | null;
  notice_date: string | null;
  data_json: string;
  created_by_name: string | null;
  exported_at: string | null;
  printed_at: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export const defaultLaborContractTerminationData: LaborContractTerminationFormData = {
  employeeName: '',
  honorific: '女士/先生',
  terminationDate: '',
  reason: '在培训期间，经考察不符合公司用工要求。',
  procedureDeadline: '',
  companyName: '东莞山泽新能源有限公司',
  noticeDate: '',
  remark: '',
};

export function createDefaultLaborContractTerminationData(): LaborContractTerminationFormData {
  return {
    ...defaultLaborContractTerminationData,
    noticeDate: chinaToday(),
  };
}

export function normalizeLaborContractTerminationData(value: unknown): LaborContractTerminationFormData {
  const data = typeof value === 'object' && value ? value as Partial<LaborContractTerminationFormData> : {};
  const merged = { ...createDefaultLaborContractTerminationData(), ...data };
  const honorific = merged.honorific === '女士' || merged.honorific === '先生' ? merged.honorific : '女士/先生';

  return {
    ...merged,
    employeeName: String(merged.employeeName || '').trim(),
    honorific,
    terminationDate: String(merged.terminationDate || '').trim(),
    reason: String(merged.reason || '').trim() || defaultLaborContractTerminationData.reason,
    procedureDeadline: String(merged.procedureDeadline || '').trim(),
    companyName: String(merged.companyName || '').trim() || defaultLaborContractTerminationData.companyName,
    noticeDate: String(merged.noticeDate || '').trim(),
    remark: String(merged.remark || '').trim(),
  };
}

export function parseLaborContractTerminationRow(row: LaborContractTerminationDbRow): LaborContractTerminationRecord {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(row.data_json || '{}');
  } catch {
    parsed = {};
  }

  const data = normalizeLaborContractTerminationData(parsed);
  return {
    id: row.id,
    data,
    employeeName: row.employee_name || data.employeeName,
    honorific: row.honorific || data.honorific,
    terminationDate: row.termination_date || data.terminationDate,
    reason: row.reason || data.reason,
    procedureDeadline: row.procedure_deadline || data.procedureDeadline,
    companyName: row.company_name || data.companyName,
    noticeDate: row.notice_date || data.noticeDate,
    createdByName: row.created_by_name,
    exportedAt: row.exported_at,
    printedAt: row.printed_at,
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
