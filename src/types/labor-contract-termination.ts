export interface LaborContractTerminationFormData {
  employeeName: string;
  honorific: '女士' | '先生' | '女士/先生';
  terminationDate: string;
  reason: string;
  procedureDeadline: string;
  companyName: string;
  noticeDate: string;
  remark: string;
}

export interface LaborContractTerminationRecord {
  id: number;
  data: LaborContractTerminationFormData;
  employeeName: string;
  honorific: string;
  terminationDate: string;
  reason: string;
  procedureDeadline: string;
  companyName: string;
  noticeDate: string;
  createdByName: string | null;
  exportedAt: string | null;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  restoreUntil: string | null;
}
