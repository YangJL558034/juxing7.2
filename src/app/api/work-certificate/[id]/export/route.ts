import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { buildWorkCertificateDocx } from '@/lib/work-certificate-docx';
import { parseWorkCertificateRow, type WorkCertificateDbRow } from '@/lib/work-certificate-records';

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

    const row = db.prepare('SELECT * FROM work_certificate_records WHERE id = ? AND deleted_at IS NULL').get(id) as WorkCertificateDbRow | undefined;
    if (!row) return NextResponse.json({ success: false, error: '工作证明申请不存在或已删除' }, { status: 404 });

    const record = parseWorkCertificateRow(row);
    if (record.status !== '已审核') {
      return NextResponse.json({ success: false, error: '请先审核再导出' }, { status: 400 });
    }

    const buffer = buildWorkCertificateDocx(record);
    const filename = `${record.name || '员工'}-工作证明.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export work certificate error:', error);
    return NextResponse.json({ success: false, error: '导出工作证明失败' }, { status: 500 });
  }
}
