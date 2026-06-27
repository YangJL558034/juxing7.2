import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import {
  normalizeSocialSecurityPurchaseData,
  parseSocialSecurityPurchaseRow,
  type SocialSecurityPurchaseDbRow,
} from '@/lib/social-security-purchase-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });

    const row = db.prepare('SELECT * FROM social_security_purchase_records WHERE id = ? AND deleted_at IS NULL').get(id) as SocialSecurityPurchaseDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '购买社保记录不存在或已删除' }, { status: 404 });
    }

    const current = parseSocialSecurityPurchaseRow(row);
    const body = await request.json();
    const data = normalizeSocialSecurityPurchaseData({ ...current, ...(body?.data || {}) });
    if (!data.employeeName) return NextResponse.json({ success: false, error: '员工姓名不能为空' }, { status: 400 });
    if (!data.idCard) return NextResponse.json({ success: false, error: '身份证号不能为空' }, { status: 400 });

    db.prepare(`
      UPDATE social_security_purchase_records
      SET category = ?,
          contract_status = ?,
          department = ?,
          employee_name = ?,
          domicile = ?,
          id_card = ?,
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
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
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
      id,
    );

    const updated = db.prepare('SELECT * FROM social_security_purchase_records WHERE id = ?').get(id) as SocialSecurityPurchaseDbRow;
    return NextResponse.json({
      success: true,
      record: parseSocialSecurityPurchaseRow(updated),
      message: '购买社保记录修改成功',
    });
  } catch (error) {
    console.error('Update social security purchase record error:', error);
    return NextResponse.json({ success: false, error: '修改购买社保记录失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });

    const row = db.prepare('SELECT id FROM social_security_purchase_records WHERE id = ? AND deleted_at IS NULL').get(id) as { id: number } | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '购买社保记录不存在或已删除' }, { status: 404 });
    }

    db.prepare(`
      UPDATE social_security_purchase_records
      SET deleted_at = datetime('now', '+8 hours'),
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    return NextResponse.json({ success: true, message: '购买社保记录已删除，一周内可恢复' });
  } catch (error) {
    console.error('Delete social security purchase record error:', error);
    return NextResponse.json({ success: false, error: '删除购买社保记录失败' }, { status: 500 });
  }
}
