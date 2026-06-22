import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseLaborContractTerminationRow, type LaborContractTerminationDbRow } from '@/lib/labor-contract-termination-records';

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

    const row = db.prepare(`
      SELECT * FROM labor_contract_termination_records
      WHERE id = ?
        AND deleted_at IS NOT NULL
        AND deleted_at >= datetime('now', '+8 hours', '-7 days')
    `).get(id) as LaborContractTerminationDbRow | undefined;
    if (!row) return NextResponse.json({ success: false, error: '记录不存在或已超过恢复期限' }, { status: 404 });

    db.prepare(`
      UPDATE labor_contract_termination_records
      SET deleted_at = NULL,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    const updated = db.prepare('SELECT * FROM labor_contract_termination_records WHERE id = ?').get(id) as LaborContractTerminationDbRow;
    return NextResponse.json({
      success: true,
      record: parseLaborContractTerminationRow(updated),
      message: '解除劳动合同通知书已恢复',
    });
  } catch (error) {
    console.error('Restore labor contract termination record error:', error);
    return NextResponse.json({ success: false, error: '恢复解除劳动合同通知书失败' }, { status: 500 });
  }
}
