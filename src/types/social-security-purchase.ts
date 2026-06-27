export type SocialSecurityPurchaseCategory = 'production' | 'management';

export interface SocialSecurityPurchaseFormData {
  category: SocialSecurityPurchaseCategory;
  contractStatus: string;
  department: string;
  employeeName: string;
  domicile: string;
  idCard: string;
  phone: string;
  bankCard: string;
  gender: string;
  birthDate: string;
  education: string;
  insuranceStatus: string;
  contractCount: string;
  contractStartDate: string;
  contractTermYears: string;
  contractEndDate: string;
  dueDays: string;
  employmentStatus: string;
  resignationDate: string;
  confidentialityAgreement: string;
  probationSalary: string;
  remarks: string;
}

export interface SocialSecurityPurchaseRecord extends SocialSecurityPurchaseFormData {
  id: number;
  categoryLabel: string;
  exportedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  restoreUntil: string | null;
}
