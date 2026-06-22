import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import {
  buildResignationCertificateDocx,
  type ResignationCertificateDocumentType,
} from '@/lib/resignation-certificate-docx';
import { parseResignationCertificateRow, type ResignationCertificateDbRow } from '@/lib/resignation-certificate-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function documentTypeFromRequest(request: NextRequest): ResignationCertificateDocumentType {
  const type = new URL(request.url).searchParams.get('type');
  return type === 'receipt' ? 'receipt' : 'certificate';
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });

    const row = db.prepare('SELECT * FROM resignation_certificate_records WHERE id = ? AND deleted_at IS NULL').get(id) as ResignationCertificateDbRow | undefined;
    if (!row) return NextResponse.json({ success: false, error: '离职证明不存在或已删除' }, { status: 404 });

    const record = parseResignationCertificateRow(row);
    const documentType = documentTypeFromRequest(request);
    const buffer = buildResignationCertificateDocx(record, documentType);
    const timestampColumn = documentType === 'receipt' ? 'receipt_exported_at' : 'certificate_exported_at';
    db.prepare(`UPDATE resignation_certificate_records SET ${timestampColumn} = datetime('now', '+8 hours'), updated_at = datetime('now', '+8 hours') WHERE id = ?`).run(id);

    const suffix = documentType === 'receipt'
      ? '离职证明签收回执'
      : record.certificateType === 'company'
        ? '离职证明-公司提出'
        : '离职证明-个人辞职';
    const filename = `${record.employeeName || '员工'}-${suffix}.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export resignation certificate record error:', error);
    return NextResponse.json({ success: false, error: '导出离职证明失败' }, { status: 500 });
  }
}
