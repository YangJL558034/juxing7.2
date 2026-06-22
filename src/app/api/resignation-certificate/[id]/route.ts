import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import {
  normalizeResignationCertificateData,
  parseResignationCertificateRow,
  type ResignationCertificateDbRow,
} from '@/lib/resignation-certificate-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });

    const row = db.prepare('SELECT * FROM resignation_certificate_records WHERE id = ? AND deleted_at IS NULL').get(id) as ResignationCertificateDbRow | undefined;
    if (!row) return NextResponse.json({ success: false, error: '离职证明不存在或已删除' }, { status: 404 });

    const body = await request.json();
    const current = parseResignationCertificateRow(row);
    const data = normalizeResignationCertificateData({
      ...current.data,
      ...body?.data,
    });

    if (!data.employeeName) return NextResponse.json({ success: false, error: '员工姓名不能为空' }, { status: 400 });
    if (!data.idCard) return NextResponse.json({ success: false, error: '身份证不能为空' }, { status: 400 });
    if (!data.email) return NextResponse.json({ success: false, error: '邮箱不能为空' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return NextResponse.json({ success: false, error: '邮箱格式不正确' }, { status: 400 });
    }

    db.prepare(`
      UPDATE resignation_certificate_records
      SET certificate_type = ?,
          employee_name = ?,
          id_card = ?,
          phone = ?,
          email = ?,
          honorific = ?,
          department = ?,
          position = ?,
          hire_date = ?,
          leave_date = ?,
          issue_date = ?,
          company_name = ?,
          receipt_date = ?,
          data_json = ?,
          reviewer_name = ?,
          review_remark = ?,
          stamped_file_name = ?,
          stamped_file_mime = ?,
          stamped_file_data = ?,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(
      data.certificateType,
      data.employeeName,
      data.idCard,
      data.phone,
      data.email,
      data.honorific,
      data.department,
      data.position,
      data.hireDate,
      data.leaveDate,
      data.issueDate,
      data.companyName,
      data.receiptDate,
      JSON.stringify(data),
      data.reviewerName,
      data.reviewRemark,
      data.stampedFileName,
      data.stampedFileMime,
      data.stampedFileData || row.stamped_file_data || '',
      id,
    );

    const updated = db.prepare('SELECT * FROM resignation_certificate_records WHERE id = ?').get(id) as ResignationCertificateDbRow;
    return NextResponse.json({
      success: true,
      record: parseResignationCertificateRow(updated),
      message: '离职证明已修改',
    });
  } catch (error) {
    console.error('Update resignation certificate record error:', error);
    return NextResponse.json({ success: false, error: '修改离职证明失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });

    const row = db.prepare('SELECT id FROM resignation_certificate_records WHERE id = ? AND deleted_at IS NULL').get(id) as { id: number } | undefined;
    if (!row) return NextResponse.json({ success: false, error: '离职证明不存在或已删除' }, { status: 404 });

    db.prepare(`
      UPDATE resignation_certificate_records
      SET deleted_at = datetime('now', '+8 hours'),
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    return NextResponse.json({ success: true, message: '离职证明已删除，一周内可恢复，超过一周会完全清除' });
  } catch (error) {
    console.error('Delete resignation certificate record error:', error);
    return NextResponse.json({ success: false, error: '删除离职证明失败' }, { status: 500 });
  }
}
