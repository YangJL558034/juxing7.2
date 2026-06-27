import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseSocialSecurityRow, type SocialSecurityDbRow } from '@/lib/social-security-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function parseId(rawId: string) {
  const id = Number(rawId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }

    const row = db.prepare('SELECT * FROM social_security_records WHERE id = ? AND deleted_at IS NULL').get(id) as SocialSecurityDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '社保申请不存在或已删除' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({})) as { reviewerName?: string };
    const reviewerName = String(body.reviewerName || user.name || user.username || '').trim();
    if (!reviewerName) {
      return NextResponse.json({ success: false, error: '审核人不能为空' }, { status: 400 });
    }

    db.prepare(`
      UPDATE social_security_records
      SET status = '已审核',
          reviewer_name = ?,
          reviewed_at = datetime('now', '+8 hours'),
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(reviewerName, id);

    const updated = db.prepare('SELECT * FROM social_security_records WHERE id = ?').get(id) as SocialSecurityDbRow;
    return NextResponse.json({
      success: true,
      record: parseSocialSecurityRow(updated),
      message: '社保申请审核完成',
    });
  } catch (error) {
    console.error('Review social security record error:', error);
    return NextResponse.json({ success: false, error: '审核社保申请失败' }, { status: 500 });
  }
}
