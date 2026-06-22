import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import type { ResignationCertificateDbRow } from '@/lib/resignation-certificate-records';

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const employeeName = String(body?.employeeName || '').trim();
    const idCard = String(body?.idCard || '').trim();

    if (!employeeName) return NextResponse.json({ success: false, error: '请输入申请人姓名' }, { status: 400 });
    if (!idCard) return NextResponse.json({ success: false, error: '请输入身份证号码' }, { status: 400 });

    const row = db.prepare(`
      SELECT * FROM resignation_certificate_records
      WHERE deleted_at IS NULL
        AND status = '已完成'
        AND employee_name = ?
        AND id_card = ?
        AND stamped_file_data IS NOT NULL
        AND stamped_file_data <> ''
        AND completed_at IS NOT NULL
        AND completed_at >= datetime('now', '+8 hours', '-15 days')
      ORDER BY completed_at DESC, id DESC
      LIMIT 1
    `).get(employeeName, idCard) as ResignationCertificateDbRow | undefined;

    if (!row?.stamped_file_data) {
      return NextResponse.json({ success: false, error: '没有可下载的离职证明' }, { status: 404 });
    }

    const parsed = parseDataUrl(row.stamped_file_data);
    if (!parsed) {
      return NextResponse.json({ success: false, error: '离职证明文件格式异常' }, { status: 500 });
    }

    const filename = row.stamped_file_name || `${row.employee_name || '员工'}-离职证明`;
    return new NextResponse(new Uint8Array(parsed.buffer), {
      headers: {
        'Content-Type': row.stamped_file_mime || parsed.mime || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Download resignation certificate error:', error);
    return NextResponse.json({ success: false, error: '下载离职证明失败' }, { status: 500 });
  }
}
