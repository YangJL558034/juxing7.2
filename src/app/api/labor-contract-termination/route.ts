import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { normalizeLaborContractTerminationData, parseLaborContractTerminationRow, type LaborContractTerminationDbRow } from '@/lib/labor-contract-termination-records';

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
    const keyword = searchParams.get('keyword')?.trim();
    const deleted = searchParams.get('deleted') === '1';
    const where: string[] = [];
    const params: unknown[] = [];

    db.prepare("DELETE FROM labor_contract_termination_records WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '+8 hours', '-7 days')").run();

    if (deleted) {
      where.push("deleted_at IS NOT NULL AND deleted_at >= datetime('now', '+8 hours', '-7 days')");
    } else {
      where.push('deleted_at IS NULL');
    }
    if (keyword) {
      where.push('(employee_name LIKE ? OR reason LIKE ? OR company_name LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const rows = db.prepare(`
      SELECT * FROM labor_contract_termination_records
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
    `).all(...params) as LaborContractTerminationDbRow[];

    return NextResponse.json({ success: true, records: rows.map(parseLaborContractTerminationRow) });
  } catch (error) {
    console.error('Get labor contract termination records error:', error);
    return NextResponse.json({ success: false, error: '获取解除劳动合同通知书失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });

    const body = await request.json();
    const data = normalizeLaborContractTerminationData(body?.data || body);

    if (!data.employeeName) return NextResponse.json({ success: false, error: '员工姓名不能为空' }, { status: 400 });
    if (!data.terminationDate) return NextResponse.json({ success: false, error: '解除日期不能为空' }, { status: 400 });
    if (!data.reason) return NextResponse.json({ success: false, error: '解除原因不能为空' }, { status: 400 });
    if (!data.procedureDeadline) return NextResponse.json({ success: false, error: '离职手续办理截止日期不能为空' }, { status: 400 });
    if (!data.noticeDate) return NextResponse.json({ success: false, error: '通知日期不能为空' }, { status: 400 });

    const result = db.prepare(`
      INSERT INTO labor_contract_termination_records (
        employee_name, honorific, termination_date, reason, procedure_deadline,
        company_name, notice_date, data_json, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.employeeName,
      data.honorific,
      data.terminationDate,
      data.reason,
      data.procedureDeadline,
      data.companyName,
      data.noticeDate,
      JSON.stringify(data),
      user.name || user.username || '',
    );

    const row = db.prepare('SELECT * FROM labor_contract_termination_records WHERE id = ?').get(result.lastInsertRowid) as LaborContractTerminationDbRow;
    return NextResponse.json({
      success: true,
      record: parseLaborContractTerminationRow(row),
      message: '解除劳动合同通知书已保存',
    });
  } catch (error) {
    console.error('Create labor contract termination record error:', error);
    return NextResponse.json({ success: false, error: '保存解除劳动合同通知书失败' }, { status: 500 });
  }
}
