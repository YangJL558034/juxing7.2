import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import type { ResignationCertificateDbRow } from '@/lib/resignation-certificate-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });

    const row = db.prepare('SELECT * FROM resignation_certificate_records WHERE id = ?').get(id) as ResignationCertificateDbRow | undefined;
    if (!row?.stamped_file_data) {
      return NextResponse.json({ success: false, error: '没有可查看的上传文件' }, { status: 404 });
    }

    const parsed = parseDataUrl(row.stamped_file_data);
    if (!parsed) {
      return NextResponse.json({ success: false, error: '上传文件格式异常' }, { status: 500 });
    }

    const filename = row.stamped_file_name || `${row.employee_name || '员工'}-离职证明`;
    return new NextResponse(new Uint8Array(parsed.buffer), {
      headers: {
        'Content-Type': row.stamped_file_mime || parsed.mime || 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('View stamped resignation certificate file error:', error);
    return NextResponse.json({ success: false, error: '查看上传文件失败' }, { status: 500 });
  }
}
