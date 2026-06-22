import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import {
  normalizeSocialSecurityData,
  parseSocialSecurityRow,
  type SocialSecurityDbRow,
} from '@/lib/social-security-records';

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

    const body = await request.json();
    const current = parseSocialSecurityRow(row);
    const data = normalizeSocialSecurityData({
      ...current.data,
      ...body?.data,
    });

    if (!data.name) {
      return NextResponse.json({ success: false, error: '姓名不能为空' }, { status: 400 });
    }
    if (!data.idCard) {
      return NextResponse.json({ success: false, error: '身份证号码不能为空' }, { status: 400 });
    }

    db.prepare(`
      UPDATE social_security_records
      SET document_type = ?,
          name = ?,
          id_card = ?,
          phone = ?,
          department = ?,
          position = ?,
          hire_date = ?,
          application_date = ?,
          data_json = ?,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(
      data.documentType,
      data.name,
      data.idCard,
      data.phone,
      data.department,
      data.position,
      data.hireDate,
      data.applicationDate,
      JSON.stringify(data),
      id,
    );

    const updated = db.prepare('SELECT * FROM social_security_records WHERE id = ?').get(id) as SocialSecurityDbRow;
    return NextResponse.json({
      success: true,
      record: parseSocialSecurityRow(updated),
      message: '社保申请修改成功',
    });
  } catch (error) {
    console.error('Update social security record error:', error);
    return NextResponse.json({ success: false, error: '修改社保申请失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const row = db.prepare('SELECT id FROM social_security_records WHERE id = ? AND deleted_at IS NULL').get(id) as { id: number } | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '社保申请不存在或已删除' }, { status: 404 });
    }

    db.prepare(`
      UPDATE social_security_records
      SET deleted_at = datetime('now', '+8 hours'),
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(id);

    return NextResponse.json({ success: true, message: '社保申请已删除，一周内可恢复' });
  } catch (error) {
    console.error('Delete social security record error:', error);
    return NextResponse.json({ success: false, error: '删除社保申请失败' }, { status: 500 });
  }
}
