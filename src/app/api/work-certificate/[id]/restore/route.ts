import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseWorkCertificateRow, type WorkCertificateDbRow } from '@/lib/work-certificate-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const row = db.prepare(`
      SELECT * FROM work_certificate_records
      WHERE id = ?
        AND deleted_at IS NOT NULL
        AND deleted_at >= datetime('now', '+8 hours', '-7 days')
    `).get(id) as WorkCertificateDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '记录不存在或已超过恢复期限' }, { status: 404 });
    }

    db.prepare(`
      UPDATE work_certificate_records
      SET deleted_at = NULL,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    const updated = db.prepare('SELECT * FROM work_certificate_records WHERE id = ?').get(id) as WorkCertificateDbRow;
    return NextResponse.json({
      success: true,
      record: parseWorkCertificateRow(updated),
      message: '工作证明申请已恢复',
    });
  } catch (error) {
    console.error('Restore work certificate record error:', error);
    return NextResponse.json({ success: false, error: '恢复工作证明申请失败' }, { status: 500 });
  }
}
