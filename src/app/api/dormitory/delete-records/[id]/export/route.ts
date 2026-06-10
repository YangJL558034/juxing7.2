import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { buildDormitoryApplicationXlsx } from '@/lib/dormitory-xlsx';
import {
  cleanupExpiredDormitoryDeleteRecords,
  ensureDormitoryDeleteRecordsTable,
  getDeleteRecordAsDormitoryRecord,
  type DormitoryDeleteDbRow,
} from '@/lib/dormitory-delete-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    ensureDormitoryDeleteRecordsTable();
    cleanupExpiredDormitoryDeleteRecords();

    const { id } = await params;
    const row = db.prepare(`
      SELECT *, datetime(deleted_at, '+1 month') AS expires_at
      FROM dormitory_delete_records
      WHERE id = ?
        AND deleted_at >= datetime('now', '+8 hours', '-1 month')
    `).get(id) as DormitoryDeleteDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '删除记录不存在或已过期' }, { status: 404 });
    }

    const record = getDeleteRecordAsDormitoryRecord(row);
    const xlsx = buildDormitoryApplicationXlsx(record);
    const body = xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.byteLength) as ArrayBuffer;
    const filename = `${record.name || '员工'}-已删除住宿舍申请表.xlsx`;

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'administration',
      action: 'export-deleted-dormitory',
      details: { deleteRecordId: id, dormitoryId: row.dormitory_record_id, employeeName: record.name },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export deleted dormitory record error:', error);
    return NextResponse.json({ success: false, error: '导出删除记录失败' }, { status: 500 });
  }
}
