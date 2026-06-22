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

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.trim();
    const type = searchParams.get('type')?.trim();
    const keyword = searchParams.get('keyword')?.trim();
    const deleted = searchParams.get('deleted') === '1';
    const where: string[] = [];
    const params: unknown[] = [];

    db.prepare("DELETE FROM social_security_records WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '+8 hours', '-7 days')").run();

    if (deleted) {
      where.push("deleted_at IS NOT NULL AND deleted_at >= datetime('now', '+8 hours', '-7 days')");
    } else {
      where.push('deleted_at IS NULL');
    }
    if (status && status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    if (type && type !== 'all') {
      where.push('document_type = ?');
      params.push(type);
    }
    if (keyword) {
      where.push('(name LIKE ? OR id_card LIKE ? OR phone LIKE ? OR department LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const rows = db.prepare(`
      SELECT * FROM social_security_records
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
    `).all(...params) as SocialSecurityDbRow[];

    return NextResponse.json({ success: true, records: rows.map(parseSocialSecurityRow) });
  } catch (error) {
    console.error('Get social security records error:', error);
    return NextResponse.json({ success: false, error: '获取社保申请记录失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = normalizeSocialSecurityData(body?.data || body);

    if (!data.name) {
      return NextResponse.json({ success: false, error: '姓名不能为空' }, { status: 400 });
    }
    if (!data.idCard) {
      return NextResponse.json({ success: false, error: '身份证号码不能为空' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO social_security_records (
        document_type, status, name, id_card, phone, department, position, hire_date, application_date, data_json
      ) VALUES (?, '待处理', ?, ?, ?, ?, ?, ?, ?, ?)
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
    );

    return NextResponse.json({
      success: true,
      id: Number(result.lastInsertRowid),
      message: '社保申请提交成功',
    });
  } catch (error) {
    console.error('Create social security record error:', error);
    return NextResponse.json({ success: false, error: '提交社保申请失败' }, { status: 500 });
  }
}
