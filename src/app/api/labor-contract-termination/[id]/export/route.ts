import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { buildLaborContractTerminationDocx } from '@/lib/labor-contract-termination-docx';
import { parseLaborContractTerminationRow, type LaborContractTerminationDbRow } from '@/lib/labor-contract-termination-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });

    const row = db.prepare('SELECT * FROM labor_contract_termination_records WHERE id = ? AND deleted_at IS NULL').get(id) as LaborContractTerminationDbRow | undefined;
    if (!row) return NextResponse.json({ success: false, error: '记录不存在或已删除' }, { status: 404 });

    const record = parseLaborContractTerminationRow(row);
    const buffer = buildLaborContractTerminationDocx(record);
    db.prepare("UPDATE labor_contract_termination_records SET exported_at = datetime('now', '+8 hours'), updated_at = datetime('now', '+8 hours') WHERE id = ?").run(id);

    const filename = `${record.employeeName || '员工'}-解除劳动合同通知书.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export labor contract termination record error:', error);
    return NextResponse.json({ success: false, error: '导出解除劳动合同通知书失败' }, { status: 500 });
  }
}
