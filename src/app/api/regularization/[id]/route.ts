import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { normalizeRegularizationData, parseRegularizationRow, type RegularizationDbRow } from '@/lib/regularization-records';

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

    const row = db.prepare('SELECT * FROM regularization_records WHERE id = ? AND deleted_at IS NULL').get(id) as RegularizationDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '转正申请不存在' }, { status: 404 });
    }

    const body = await request.json();
    const current = parseRegularizationRow(row);
    const data = normalizeRegularizationData({
      ...current.data,
      ...body?.data,
    });

    if (!data.applicantName) {
      return NextResponse.json({ success: false, error: '申请人不能为空' }, { status: 400 });
    }
    if (!data.department) {
      return NextResponse.json({ success: false, error: '部门不能为空' }, { status: 400 });
    }
    if (!data.position) {
      return NextResponse.json({ success: false, error: '岗位不能为空' }, { status: 400 });
    }
    if (!data.hireDate) {
      return NextResponse.json({ success: false, error: '入职日期不能为空' }, { status: 400 });
    }
    if (!data.regularizationDate) {
      return NextResponse.json({ success: false, error: '转正日期不能为空' }, { status: 400 });
    }
    if (!data.workSummary) {
      return NextResponse.json({ success: false, error: '试用期工作小结不能为空' }, { status: 400 });
    }

    db.prepare(`
      UPDATE regularization_records
      SET applicant_name = ?,
          department = ?,
          position = ?,
          hire_date = ?,
          regularization_date = ?,
          data_json = ?,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(
      data.applicantName,
      data.department,
      data.position,
      data.hireDate,
      data.regularizationDate,
      JSON.stringify(data),
      id,
    );

    const updated = db.prepare('SELECT * FROM regularization_records WHERE id = ?').get(id) as RegularizationDbRow;
    return NextResponse.json({
      success: true,
      record: parseRegularizationRow(updated),
      message: '转正申请修改成功',
    });
  } catch (error) {
    console.error('Update regularization record error:', error);
    return NextResponse.json({ success: false, error: '修改转正申请失败' }, { status: 500 });
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

    const row = db.prepare('SELECT * FROM regularization_records WHERE id = ? AND deleted_at IS NULL').get(id) as RegularizationDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '转正申请不存在或已删除' }, { status: 404 });
    }

    db.prepare(`
      UPDATE regularization_records
      SET deleted_at = datetime('now', '+8 hours'),
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    return NextResponse.json({ success: true, message: '转正申请已删除，可在一周内恢复' });
  } catch (error) {
    console.error('Delete regularization record error:', error);
    return NextResponse.json({ success: false, error: '删除转正申请失败' }, { status: 500 });
  }
}
