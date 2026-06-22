export type ResignationCertificateType = 'personal' | 'company';
export type ResignationCertificateStatus = '待审核' | '已完成';

export interface ResignationCertificateFormData {
  certificateType: ResignationCertificateType;
  employeeName: string;
  idCard: string;
  phone: string;
  email: string;
  honorific: '女士' | '先生';
  department: string;
  position: string;
  hireDate: string;
  leaveDate: string;
  issueDate: string;
  companyName: string;
  receiptDate: string;
  reviewerName: string;
  reviewRemark: string;
  stampedFileName: string;
  stampedFileMime: string;
  stampedFileData?: string;
  remark: string;
}

export interface ResignationCertificateRecord {
  id: number;
  status: ResignationCertificateStatus;
  data: ResignationCertificateFormData;
  certificateType: ResignationCertificateType;
  employeeName: string;
  idCard: string;
  phone: string;
  email: string;
  honorific: string;
  department: string;
  position: string;
  hireDate: string;
  leaveDate: string;
  issueDate: string;
  companyName: string;
  receiptDate: string;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewRemark: string | null;
  stampedFileName: string | null;
  stampedFileMime: string | null;
  hasStampedFile: boolean;
  completedAt: string | null;
  emailSentAt: string | null;
  emailError: string | null;
  createdByName: string | null;
  certificateExportedAt: string | null;
  receiptExportedAt: string | null;
  certificatePrintedAt: string | null;
  receiptPrintedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  restoreUntil: string | null;
}
