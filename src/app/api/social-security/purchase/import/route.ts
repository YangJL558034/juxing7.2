import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseSocialSecurityPurchaseWorkbook } from '@/lib/social-security-purchase-xlsx';
import { normalizeSocialSecurityPurchaseData } from '@/lib/social-security-purchase-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const category = formData.get('category') || 'production';
    if (!file) {
      return NextResponse.json({ success: false, error: '请上传 Excel 文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseSocialSecurityPurchaseWorkbook(buffer, category);
    if (parsed.records.length === 0) {
      return NextResponse.json({ success: false, error: '未解析到有效员工记录，请确认员工姓名和身份证号已填写' }, { status: 400 });
    }

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    const insertStmt = db.prepare(`
      INSERT INTO social_security_purchase_records (
        category, contract_status, department, employee_name, domicile, id_card, phone, bank_card,
        gender, birth_date, education, insurance_status, contract_count, contract_start_date,
        contract_term_years, contract_end_date, due_days, employment_status, resignation_date,
        confidentiality_agreement, probation_salary, remarks, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStmt = db.prepare(`
      UPDATE social_security_purchase_records
      SET contract_status = ?,
          department = ?,
          employee_name = ?,
          domicile = ?,
          phone = ?,
          bank_card = ?,
          gender = ?,
          birth_date = ?,
          education = ?,
          insurance_status = ?,
          contract_count = ?,
          contract_start_date = ?,
          contract_term_years = ?,
          contract_end_date = ?,
          due_days = ?,
          employment_status = ?,
          resignation_date = ?,
          confidentiality_agreement = ?,
          probation_salary = ?,
          remarks = ?,
          data_json = ?,
          deleted_at = NULL,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `);
    const findStmt = db.prepare('SELECT id FROM social_security_purchase_records WHERE category = ? AND id_card = ? LIMIT 1');

    const transaction = db.transaction(() => {
      for (const raw of parsed.records) {
        try {
          const data = normalizeSocialSecurityPurchaseData(raw);
          const existing = findStmt.get(data.category, data.idCard) as { id: number } | undefined;
          if (existing) {
            updateStmt.run(
              data.contractStatus,
              data.department,
              data.employeeName,
              data.domicile,
              data.phone,
              data.bankCard,
              data.gender,
              data.birthDate,
              data.education,
              data.insuranceStatus,
              data.contractCount,
              data.contractStartDate,
              data.contractTermYears,
              data.contractEndDate,
              data.dueDays,
              data.employmentStatus,
              data.resignationDate,
              data.confidentialityAgreement,
              data.probationSalary,
              data.remarks,
              JSON.stringify(data),
              existing.id,
            );
            updated++;
          } else {
            insertStmt.run(
              data.category,
              data.contractStatus,
              data.department,
              data.employeeName,
              data.domicile,
              data.idCard,
              data.phone,
              data.bankCard,
              data.gender,
              data.birthDate,
              data.education,
              data.insuranceStatus,
              data.contractCount,
              data.contractStartDate,
              data.contractTermYears,
              data.contractEndDate,
              data.dueDays,
              data.employmentStatus,
              data.resignationDate,
              data.confidentialityAgreement,
              data.probationSalary,
              data.remarks,
              JSON.stringify(data),
            );
            imported++;
          }
        } catch (error) {
          errors.push(`${raw.employeeName || raw.idCard || '未知员工'}导入失败：${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
    });

    transaction();

    return NextResponse.json({
      success: true,
      message: `导入完成：新增 ${imported} 条，更新 ${updated} 条`,
      imported,
      updated,
      total: parsed.records.length,
      sheetName: parsed.sheetName,
      headerRow: parsed.headerRow,
      missingHeaders: parsed.missingHeaders,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error('Import social security purchase records error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '导入购买社保记录失败',
    }, { status: 500 });
  }
}
