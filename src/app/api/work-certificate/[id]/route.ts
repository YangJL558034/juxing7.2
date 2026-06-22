import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { normalizeWorkCertificateData, parseWorkCertificateRow, type WorkCertificateDbRow } from '@/lib/work-certificate-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }

    const row = db.prepare('SELECT * FROM work_certificate_records WHERE id = ? AND deleted_at IS NULL').get(id) as WorkCertificateDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '工作证明申请不存在或已删除' }, { status: 404 });
    }

    const body = await request.json();
    const current = parseWorkCertificateRow(row);
    const data = normalizeWorkCertificateData({
      ...current.data,
      ...body?.data,
    });

    if (!data.name) {
      return NextResponse.json({ success: false, error: '姓名不能为空' }, { status: 400 });
    }
    if (!data.gender) {
      return NextResponse.json({ success: false, error: '性别不能为空' }, { status: 400 });
    }
    if (!data.idCard) {
      return NextResponse.json({ success: false, error: '身份证号码不能为空' }, { status: 400 });
    }
    if (current.status === '已审核') {
      if (!data.department) return NextResponse.json({ success: false, error: '部门不能为空' }, { status: 400 });
      if (!data.position) return NextResponse.json({ success: false, error: '岗位不能为空' }, { status: 400 });
      if (!data.hireDate) return NextResponse.json({ success: false, error: '入职日期不能为空' }, { status: 400 });
      if (!data.issueDate) return NextResponse.json({ success: false, error: '证明日期不能为空' }, { status: 400 });
    }

    db.prepare(`
      UPDATE work_certificate_records
      SET name = ?,
          gender = ?,
          id_card = ?,
          phone = ?,
          department = ?,
          position = ?,
          hire_date = ?,
          purpose = ?,
          data_json = ?,
          reviewer_name = ?,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(
      data.name,
      data.gender,
      data.idCard,
      data.phone,
      data.department,
      data.position,
      data.hireDate,
      data.purpose,
      JSON.stringify(data),
      data.reviewerName || row.reviewer_name || '',
      id,
    );

    const updated = db.prepare('SELECT * FROM work_certificate_records WHERE id = ?').get(id) as WorkCertificateDbRow;
    return NextResponse.json({
      success: true,
      record: parseWorkCertificateRow(updated),
      message: '工作证明申请修改成功',
    });
  } catch (error) {
    console.error('Update work certificate record error:', error);
    return NextResponse.json({ success: false, error: '修改工作证明申请失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }

    const row = db.prepare('SELECT id FROM work_certificate_records WHERE id = ? AND deleted_at IS NULL').get(id) as { id: number } | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '工作证明申请不存在或已删除' }, { status: 404 });
    }

    db.prepare(`
      UPDATE work_certificate_records
      SET deleted_at = datetime('now', '+8 hours'),
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    return NextResponse.json({ success: true, message: '工作证明申请已删除，一周后会完全清除' });
  } catch (error) {
    console.error('Delete work certificate record error:', error);
    return NextResponse.json({ success: false, error: '删除工作证明申请失败' }, { status: 500 });
  }
}
