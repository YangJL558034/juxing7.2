import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseRegularizationRow, type RegularizationDbRow } from '@/lib/regularization-records';
import { buildRegularizationDocx } from '@/lib/regularization-docx';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const row = db.prepare('SELECT * FROM regularization_records WHERE id = ?').get(id) as RegularizationDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '转正申请不存在' }, { status: 404 });
    }

    const record = parseRegularizationRow(row);
    if (record.status !== '已审核') {
      return NextResponse.json({ success: false, error: '请先完成后台审核再导出' }, { status: 400 });
    }

    const buffer = buildRegularizationDocx(record);

    const filename = `${record.applicantName || '员工'}-转正申请表.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export regularization record error:', error);
    return NextResponse.json({ success: false, error: '导出转正申请表失败' }, { status: 500 });
  }
}
