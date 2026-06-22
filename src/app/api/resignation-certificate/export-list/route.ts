import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import type { ResignationCertificateDbRow } from '@/lib/resignation-certificate-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
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

    const header = ['姓名', '身份证', '手机号', '邮箱', '证明类型', '部门', '职务', '入职日期', '离职日期', '申请时间', '状态', '是否上传盖章件', '完成时间'];
    const lines = [
      header.map(csvCell).join(','),
      ...rows.map((row) => [
        row.employee_name,
        row.id_card,
        row.phone,
        row.email,
        row.certificate_type === 'company' ? '公司提出' : '个人辞职',
        row.department,
        row.position,
        row.hire_date,
        row.leave_date,
        row.created_at,
        row.status || '待审核',
        row.stamped_file_data ? '是' : '否',
        row.completed_at,
      ].map(csvCell).join(',')),
    ];

    const csv = `\uFEFF${lines.join('\r\n')}`;
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('离职证明申请人名单.csv')}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export resignation certificate applicant list error:', error);
    return NextResponse.json({ success: false, error: '导出离职证明申请人名单失败' }, { status: 500 });
  }
}
