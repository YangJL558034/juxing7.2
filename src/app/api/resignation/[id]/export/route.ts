import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { buildResignationDocx } from '@/lib/resignation-docx';
import { parseResignationRow, type ResignationDbRow } from '@/lib/resignation-records';

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

    const row = db.prepare('SELECT * FROM resignation_records WHERE id = ? AND deleted_at IS NULL').get(id) as ResignationDbRow | undefined;
    if (!row) return NextResponse.json({ success: false, error: '员工离职申请不存在或已删除' }, { status: 404 });

    const record = parseResignationRow(row);
    if (record.status !== '已审核') {
      return NextResponse.json({ success: false, error: '请先审核员工离职申请，再导出表格' }, { status: 400 });
    }

    const buffer = buildResignationDocx(record);
    db.prepare("UPDATE resignation_records SET exported_at = datetime('now', '+8 hours'), updated_at = datetime('now', '+8 hours') WHERE id = ?").run(id);

    const filename = `${record.name || '员工'}-离职申请表.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export resignation record error:', error);
    return NextResponse.json({ success: false, error: '导出员工离职申请表失败' }, { status: 500 });
  }
}
