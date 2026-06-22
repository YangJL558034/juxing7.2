import { chinaToday } from '@/lib/china-time';
import type {
  ResignationCertificateFormData,
  ResignationCertificateRecord,
  ResignationCertificateStatus,
  ResignationCertificateType,
} from '@/types/resignation-certificate';

export interface ResignationCertificateDbRow {
  id: number;
  status: ResignationCertificateStatus | null;
  certificate_type: ResignationCertificateType | null;
  employee_name: string;
  id_card: string | null;
  phone: string | null;
  email: string | null;
  honorific: string | null;
  department: string | null;
  position: string | null;
  hire_date: string | null;
  leave_date: string | null;
  issue_date: string | null;
  company_name: string | null;
  receipt_date: string | null;
  data_json: string;
  created_by_name: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_remark: string | null;
  stamped_file_name: string | null;
  stamped_file_mime: string | null;
  stamped_file_data: string | null;
  completed_at: string | null;
  email_sent_at: string | null;
  email_error: string | null;
  certificate_exported_at: string | null;
  receipt_exported_at: string | null;
  certificate_printed_at: string | null;
  receipt_printed_at: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

export const defaultResignationCertificateData: ResignationCertificateFormData = {
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
  issueDate: '',
  companyName: '东莞山泽新能源有限公司',
  receiptDate: '',
  reviewerName: '',
  reviewRemark: '',
  stampedFileName: '',
  stampedFileMime: '',
  remark: '',
};

export function createDefaultResignationCertificateData(): ResignationCertificateFormData {
  return {
    ...defaultResignationCertificateData,
    issueDate: chinaToday(),
  };
}

export function normalizeResignationCertificateData(value: unknown): ResignationCertificateFormData {
  const data = typeof value === 'object' && value ? value as Partial<ResignationCertificateFormData> : {};
  const merged = { ...createDefaultResignationCertificateData(), ...data };
  const certificateType: ResignationCertificateType = merged.certificateType === 'company' ? 'company' : 'personal';
  const honorific = merged.honorific === '先生' ? '先生' : '女士';

  return {
    ...merged,
    certificateType,
    honorific,
    employeeName: String(merged.employeeName || '').trim(),
    idCard: String(merged.idCard || '').trim(),
    phone: String(merged.phone || '').trim(),
    email: String(merged.email || '').trim(),
    department: String(merged.department || '').trim(),
    position: String(merged.position || '').trim(),
    hireDate: String(merged.hireDate || '').trim(),
    leaveDate: String(merged.leaveDate || '').trim(),
    issueDate: String(merged.issueDate || '').trim(),
    companyName: String(merged.companyName || '').trim() || defaultResignationCertificateData.companyName,
    receiptDate: String(merged.receiptDate || '').trim(),
    reviewerName: String(merged.reviewerName || '').trim(),
    reviewRemark: String(merged.reviewRemark || '').trim(),
    stampedFileName: String(merged.stampedFileName || '').trim(),
    stampedFileMime: String(merged.stampedFileMime || '').trim(),
    stampedFileData: String(merged.stampedFileData || '').trim() || undefined,
    remark: String(merged.remark || '').trim(),
  };
}

export function parseResignationCertificateRow(row: ResignationCertificateDbRow): ResignationCertificateRecord {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(row.data_json || '{}');
  } catch {
    parsed = {};
  }

  const data = normalizeResignationCertificateData(parsed);
  const certificateType: ResignationCertificateType = row.certificate_type === 'company' ? 'company' : data.certificateType;
  const status: ResignationCertificateStatus = row.status === '已完成' ? '已完成' : '待审核';
  const stampedFileName = row.stamped_file_name || data.stampedFileName || null;
  const stampedFileMime = row.stamped_file_mime || data.stampedFileMime || null;

  return {
    id: row.id,
    status,
    data: {
      ...data,
      certificateType,
      employeeName: row.employee_name || data.employeeName,
      idCard: row.id_card || data.idCard,
      phone: row.phone || data.phone,
      email: row.email || data.email,
      honorific: row.honorific === '先生' ? '先生' : data.honorific,
      department: row.department || data.department,
      position: row.position || data.position,
      hireDate: row.hire_date || data.hireDate,
      leaveDate: row.leave_date || data.leaveDate,
      issueDate: row.issue_date || data.issueDate,
      companyName: row.company_name || data.companyName,
      receiptDate: row.receipt_date || data.receiptDate,
      reviewerName: row.reviewer_name || data.reviewerName,
      reviewRemark: row.review_remark || data.reviewRemark,
      stampedFileName: stampedFileName || '',
      stampedFileMime: stampedFileMime || '',
      stampedFileData: undefined,
    },
    certificateType,
    employeeName: row.employee_name || data.employeeName,
    idCard: row.id_card || data.idCard,
    phone: row.phone || data.phone,
    email: row.email || data.email,
    honorific: row.honorific || data.honorific,
    department: row.department || data.department,
    position: row.position || data.position,
    hireDate: row.hire_date || data.hireDate,
    leaveDate: row.leave_date || data.leaveDate,
    issueDate: row.issue_date || data.issueDate,
    companyName: row.company_name || data.companyName,
    receiptDate: row.receipt_date || data.receiptDate,
    reviewerName: row.reviewer_name,
    reviewedAt: row.reviewed_at,
    reviewRemark: row.review_remark,
    stampedFileName,
    stampedFileMime,
    hasStampedFile: Boolean(row.stamped_file_data),
    completedAt: row.completed_at,
    emailSentAt: row.email_sent_at,
    emailError: row.email_error,
    createdByName: row.created_by_name,
    certificateExportedAt: row.certificate_exported_at,
    receiptExportedAt: row.receipt_exported_at,
    certificatePrintedAt: row.certificate_printed_at,
    receiptPrintedAt: row.receipt_printed_at,
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
