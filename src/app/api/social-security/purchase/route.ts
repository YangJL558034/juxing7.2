import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import {
  normalizeSocialSecurityPurchaseCategory,
  normalizeSocialSecurityPurchaseData,
  parseSocialSecurityPurchaseRow,
  type SocialSecurityPurchaseDbRow,
} from '@/lib/social-security-purchase-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function insertRecord(dataInput: unknown) {
  const data = normalizeSocialSecurityPurchaseData(dataInput);
  if (!data.employeeName) throw new Error('员工姓名不能为空');
  if (!data.idCard) throw new Error('身份证号不能为空');

  const result = db.prepare(`
    INSERT INTO social_security_purchase_records (
      category, contract_status, department, employee_name, domicile, id_card, phone, bank_card,
      gender, birth_date, education, insurance_status, contract_count, contract_start_date,
      contract_term_years, contract_end_date, due_days, employment_status, resignation_date,
      confidentiality_agreement, probation_salary, remarks, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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

  return Number(result.lastInsertRowid);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category')?.trim();
    const employment = searchParams.get('employment')?.trim();
    const keyword = searchParams.get('keyword')?.trim();
    const deleted = searchParams.get('deleted') === '1';
    const where: string[] = [];
    const params: unknown[] = [];
    const resignedWhere = "(COALESCE(resignation_date, '') <> '' OR employment_status LIKE '%离%')";

    db.prepare("DELETE FROM social_security_purchase_records WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '+8 hours', '-7 days')").run();

    if (deleted) {
      where.push("deleted_at IS NOT NULL AND deleted_at >= datetime('now', '+8 hours', '-7 days')");
    } else {
      where.push('deleted_at IS NULL');
    }
    if (category && category !== 'all') {
      where.push('category = ?');
      params.push(normalizeSocialSecurityPurchaseCategory(category));
    }
    if (!deleted && employment === 'resigned') {
      where.push(resignedWhere);
    } else if (!deleted && employment === 'active') {
      where.push(`NOT ${resignedWhere}`);
    }
    if (keyword) {
      where.push('(employee_name LIKE ? OR id_card LIKE ? OR phone LIKE ? OR department LIKE ? OR insurance_status LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const rows = db.prepare(`
      SELECT * FROM social_security_purchase_records
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
    `).all(...params) as SocialSecurityPurchaseDbRow[];

    return NextResponse.json({ success: true, records: rows.map(parseSocialSecurityPurchaseRow) });
  } catch (error) {
    console.error('Get social security purchase records error:', error);
    return NextResponse.json({ success: false, error: '获取购买社保记录失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const id = insertRecord(body?.data || body);
    const row = db.prepare('SELECT * FROM social_security_purchase_records WHERE id = ?').get(id) as SocialSecurityPurchaseDbRow;
    return NextResponse.json({
      success: true,
      record: parseSocialSecurityPurchaseRow(row),
      message: '购买社保记录已保存',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存购买社保记录失败';
    const status = message.includes('不能为空') ? 400 : 500;
    console.error('Create social security purchase record error:', error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
