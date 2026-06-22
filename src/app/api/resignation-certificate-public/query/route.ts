import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { parseResignationCertificateRow, type ResignationCertificateDbRow } from '@/lib/resignation-certificate-records';

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

    if (!row) {
      return NextResponse.json({ success: false, error: '没有查询到可下载的离职证明，请确认姓名和身份证是否正确，或等待后台完成审核上传。' }, { status: 404 });
    }

    const record = parseResignationCertificateRow(row);
    return NextResponse.json({
      success: true,
      record: {
        id: record.id,
        employeeName: record.employeeName,
        certificateType: record.certificateType,
        issueDate: record.issueDate,
        completedAt: record.completedAt,
        stampedFileName: record.stampedFileName,
        stampedFileMime: record.stampedFileMime,
      },
    });
  } catch (error) {
    console.error('Public query resignation certificate error:', error);
    return NextResponse.json({ success: false, error: '查询离职证明失败' }, { status: 500 });
  }
}
