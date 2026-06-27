import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseSocialSecurityPurchaseRow, type SocialSecurityPurchaseDbRow } from '@/lib/social-security-purchase-records';

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
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }

    const row = db.prepare(`
      SELECT * FROM social_security_purchase_records
      WHERE id = ?
        AND deleted_at IS NOT NULL
        AND deleted_at >= datetime('now', '+8 hours', '-7 days')
    `).get(id) as SocialSecurityPurchaseDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '记录不存在或已超过恢复期限' }, { status: 404 });
    }

    db.prepare(`
      UPDATE social_security_purchase_records
      SET deleted_at = NULL,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    const updated = db.prepare('SELECT * FROM social_security_purchase_records WHERE id = ?').get(id) as SocialSecurityPurchaseDbRow;
    return NextResponse.json({
      success: true,
      record: parseSocialSecurityPurchaseRow(updated),
      message: '购买社保记录已恢复',
    });
  } catch (error) {
    console.error('Restore social security purchase record error:', error);
    return NextResponse.json({ success: false, error: '恢复购买社保记录失败' }, { status: 500 });
  }
}
