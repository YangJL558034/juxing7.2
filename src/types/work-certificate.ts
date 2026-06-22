export type WorkCertificateStatus = '待审核' | '已审核';

export interface WorkCertificateFormData {
  name: string;
  gender: '男' | '女' | '';
  idCard: string;
  phone: string;
  department: string;
  position: string;
  hireDate: string;
  purpose: string;
  companyName: string;
  issueDate: string;
  reviewerName: string;
  reviewRemark: string;
}

export interface WorkCertificateRecord {
  id: number;
  status: WorkCertificateStatus;
  data: WorkCertificateFormData;
  name: string;
  gender: string;
  idCard: string;
  phone: string;
  department: string;
  position: string;
  hireDate: string;
  purpose: string;
  reviewerName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  restoreUntil: string | null;
}
