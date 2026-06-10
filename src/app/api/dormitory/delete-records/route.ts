import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import {
  cleanupExpiredDormitoryDeleteRecords,
  ensureDormitoryDeleteRecordsTable,
  mapDormitoryDeleteRecord,
  type DormitoryDeleteDbRow,
} from '@/lib/dormitory-delete-records';

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

    ensureDormitoryDeleteRecordsTable();
    cleanupExpiredDormitoryDeleteRecords();

    const rows = db.prepare(`
      SELECT *, datetime(deleted_at, '+1 month') AS expires_at
      FROM dormitory_delete_records
      WHERE deleted_at >= datetime('now', '+8 hours', '-1 month')
      ORDER BY deleted_at DESC, id DESC
      LIMIT 300
    `).all() as DormitoryDeleteDbRow[];

    return NextResponse.json({ success: true, records: rows.map(mapDormitoryDeleteRecord) });
  } catch (error) {
    console.error('Get dormitory delete records error:', error);
    return NextResponse.json({ success: false, error: '获取删除记录失败' }, { status: 500 });
  }
}
