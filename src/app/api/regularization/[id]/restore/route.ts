import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseRegularizationRow, type RegularizationDbRow } from '@/lib/regularization-records';

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
      SELECT * FROM regularization_records
      WHERE id = ?
        AND deleted_at IS NOT NULL
        AND deleted_at >= datetime('now', '+8 hours', '-7 days')
    `).get(id) as RegularizationDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '记录不存在或已超过恢复期限' }, { status: 404 });
    }

    db.prepare(`
      UPDATE regularization_records
      SET deleted_at = NULL,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    const updated = db.prepare('SELECT * FROM regularization_records WHERE id = ?').get(id) as RegularizationDbRow;
    return NextResponse.json({
      success: true,
      record: parseRegularizationRow(updated),
      message: '转正申请已恢复',
    });
  } catch (error) {
    console.error('Restore regularization record error:', error);
    return NextResponse.json({ success: false, error: '恢复转正申请失败' }, { status: 500 });
  }
}
