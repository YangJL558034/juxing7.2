import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { normalizeLaborContractTerminationData, parseLaborContractTerminationRow, type LaborContractTerminationDbRow } from '@/lib/labor-contract-termination-records';

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

    const row = db.prepare('SELECT * FROM labor_contract_termination_records WHERE id = ? AND deleted_at IS NULL').get(id) as LaborContractTerminationDbRow | undefined;
    if (!row) return NextResponse.json({ success: false, error: '记录不存在或已删除' }, { status: 404 });

    const body = await request.json();
    const current = parseLaborContractTerminationRow(row);
    const data = normalizeLaborContractTerminationData({
      ...current.data,
      ...body?.data,
    });

    if (!data.employeeName) return NextResponse.json({ success: false, error: '员工姓名不能为空' }, { status: 400 });
    if (!data.terminationDate) return NextResponse.json({ success: false, error: '解除日期不能为空' }, { status: 400 });
    if (!data.reason) return NextResponse.json({ success: false, error: '解除原因不能为空' }, { status: 400 });
    if (!data.procedureDeadline) return NextResponse.json({ success: false, error: '离职手续办理截止日期不能为空' }, { status: 400 });
    if (!data.noticeDate) return NextResponse.json({ success: false, error: '通知日期不能为空' }, { status: 400 });

    db.prepare(`
      UPDATE labor_contract_termination_records
      SET employee_name = ?,
          honorific = ?,
          termination_date = ?,
          reason = ?,
          procedure_deadline = ?,
          company_name = ?,
          notice_date = ?,
          data_json = ?,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(
      data.employeeName,
      data.honorific,
      data.terminationDate,
      data.reason,
      data.procedureDeadline,
      data.companyName,
      data.noticeDate,
      JSON.stringify(data),
      id,
    );

    const updated = db.prepare('SELECT * FROM labor_contract_termination_records WHERE id = ?').get(id) as LaborContractTerminationDbRow;
    return NextResponse.json({
      success: true,
      record: parseLaborContractTerminationRow(updated),
      message: '解除劳动合同通知书已修改',
    });
  } catch (error) {
    console.error('Update labor contract termination record error:', error);
    return NextResponse.json({ success: false, error: '修改解除劳动合同通知书失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });

    const row = db.prepare('SELECT id FROM labor_contract_termination_records WHERE id = ? AND deleted_at IS NULL').get(id) as { id: number } | undefined;
    if (!row) return NextResponse.json({ success: false, error: '记录不存在或已删除' }, { status: 404 });

    db.prepare(`
      UPDATE labor_contract_termination_records
      SET deleted_at = datetime('now', '+8 hours'),
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    return NextResponse.json({ success: true, message: '解除劳动合同通知书已删除，一周后会完全清除' });
  } catch (error) {
    console.error('Delete labor contract termination record error:', error);
    return NextResponse.json({ success: false, error: '删除解除劳动合同通知书失败' }, { status: 500 });
  }
}
