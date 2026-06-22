import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { normalizeResignationData, parseResignationRow, type ResignationDbRow } from '@/lib/resignation-records';

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

    const row = db.prepare('SELECT * FROM resignation_records WHERE id = ? AND deleted_at IS NULL').get(id) as ResignationDbRow | undefined;
    if (!row) return NextResponse.json({ success: false, error: '员工离职申请不存在或已删除' }, { status: 404 });

    const body = await request.json();
    const current = parseResignationRow(row);
    const data = normalizeResignationData({ ...current.data, ...body?.data });

    if (!data.name) return NextResponse.json({ success: false, error: '姓名不能为空' }, { status: 400 });
    if (!data.employeeNo) return NextResponse.json({ success: false, error: '工号不能为空' }, { status: 400 });
    if (!data.department) return NextResponse.json({ success: false, error: '部门不能为空' }, { status: 400 });
    if (!data.idCard) return NextResponse.json({ success: false, error: '身份证号码不能为空' }, { status: 400 });
    if (!data.position) return NextResponse.json({ success: false, error: '职位不能为空' }, { status: 400 });
    if (!data.hireDate) return NextResponse.json({ success: false, error: '入职日期不能为空' }, { status: 400 });
    if (!data.applyDate) return NextResponse.json({ success: false, error: '申请日期不能为空' }, { status: 400 });
    if (!data.resignationDate) return NextResponse.json({ success: false, error: '正式离职日期不能为空' }, { status: 400 });
    if (!data.handoverDate) return NextResponse.json({ success: false, error: '交接日期不能为空' }, { status: 400 });
    if (!data.resignationType) return NextResponse.json({ success: false, error: '离职类型不能为空' }, { status: 400 });
    if (!data.resignationReason) return NextResponse.json({ success: false, error: '离职原因不能为空' }, { status: 400 });
    if (!data.applicantSignatureDataUrl) return NextResponse.json({ success: false, error: '请完成手写签名' }, { status: 400 });

    db.prepare(`
      UPDATE resignation_records
      SET name = ?,
          employee_no = ?,
          department = ?,
          id_card = ?,
          position = ?,
          hire_date = ?,
          contract_end_date = ?,
          apply_date = ?,
          resignation_date = ?,
          handover_date = ?,
          resignation_type = ?,
          data_json = ?,
          reviewer_name = ?,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(
      data.name,
      data.employeeNo,
      data.department,
      data.idCard,
      data.position,
      data.hireDate,
      data.contractEndDate,
      data.applyDate,
      data.resignationDate,
      data.handoverDate,
      data.resignationType,
      JSON.stringify(data),
      data.reviewerName || row.reviewer_name || '',
      id,
    );

    const updated = db.prepare('SELECT * FROM resignation_records WHERE id = ?').get(id) as ResignationDbRow;
    return NextResponse.json({ success: true, record: parseResignationRow(updated), message: '员工离职申请修改成功' });
  } catch (error) {
    console.error('Update resignation record error:', error);
    return NextResponse.json({ success: false, error: '修改员工离职申请失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });

    const row = db.prepare('SELECT id FROM resignation_records WHERE id = ? AND deleted_at IS NULL').get(id) as { id: number } | undefined;
    if (!row) return NextResponse.json({ success: false, error: '员工离职申请不存在或已删除' }, { status: 404 });

    db.prepare(`
      UPDATE resignation_records
      SET deleted_at = datetime('now', '+8 hours'),
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    return NextResponse.json({ success: true, message: '员工离职申请已删除，一周内可恢复，超过一周会完全清除' });
  } catch (error) {
    console.error('Delete resignation record error:', error);
    return NextResponse.json({ success: false, error: '删除员工离职申请失败' }, { status: 500 });
  }
}
