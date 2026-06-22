import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import {
  normalizeResignationCertificateData,
  parseResignationCertificateRow,
  type ResignationCertificateDbRow,
} from '@/lib/resignation-certificate-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status')?.trim();
    const keyword = searchParams.get('keyword')?.trim();
    const deleted = searchParams.get('deleted') === '1';
    const where: string[] = [];
    const params: unknown[] = [];

    db.prepare("DELETE FROM resignation_certificate_records WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '+8 hours', '-7 days')").run();

    if (deleted) {
      where.push("deleted_at IS NOT NULL AND deleted_at >= datetime('now', '+8 hours', '-7 days')");
    } else {
      where.push('deleted_at IS NULL');
    }
    if (status && status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }

    if (keyword) {
      where.push('(employee_name LIKE ? OR id_card LIKE ? OR phone LIKE ? OR email LIKE ? OR department LIKE ? OR position LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const rows = db.prepare(`
      SELECT * FROM resignation_certificate_records
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC, id DESC
    `).all(...params) as ResignationCertificateDbRow[];

    return NextResponse.json({ success: true, records: rows.map(parseResignationCertificateRow) });
  } catch (error) {
    console.error('Get resignation certificate records error:', error);
    return NextResponse.json({ success: false, error: '获取离职证明记录失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = normalizeResignationCertificateData(body?.data || body);

    if (!data.employeeName) return NextResponse.json({ success: false, error: '员工姓名不能为空' }, { status: 400 });
    if (!data.idCard) return NextResponse.json({ success: false, error: '身份证不能为空' }, { status: 400 });
    if (!data.email) return NextResponse.json({ success: false, error: '邮箱不能为空' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return NextResponse.json({ success: false, error: '邮箱格式不正确' }, { status: 400 });
    }

    const result = db.prepare(`
      INSERT INTO resignation_certificate_records (
        status, certificate_type, employee_name, id_card, phone, email, honorific, department, position,
        hire_date, leave_date, issue_date, company_name, receipt_date,
        data_json, created_by_name, created_at
      ) VALUES ('待审核', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', datetime('now', '+8 hours'))
    `).run(
      data.certificateType,
      data.employeeName,
      data.idCard,
      data.phone,
      data.email,
      data.honorific,
      data.department,
      data.position,
      data.hireDate,
      data.leaveDate,
      data.issueDate,
      data.companyName,
      data.receiptDate,
      JSON.stringify(data),
    );

    const row = db.prepare('SELECT * FROM resignation_certificate_records WHERE id = ?').get(result.lastInsertRowid) as ResignationCertificateDbRow;
    return NextResponse.json({
      success: true,
      record: parseResignationCertificateRow(row),
      message: '离职证明已保存',
    });
  } catch (error) {
    console.error('Create resignation certificate record error:', error);
    return NextResponse.json({ success: false, error: '保存离职证明失败' }, { status: 500 });
  }
}
