import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseDormitoryRow, type DormitoryDbRow } from '@/lib/dormitory-records';
import type { DormitoryRoomChangeRecord } from '@/types/dormitory';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function ensureChangeTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dormitory_room_change_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dormitory_record_id INTEGER NOT NULL,
      employee_name TEXT NOT NULL,
      from_room_no TEXT,
      from_bed_no TEXT,
      from_room_bed TEXT,
      to_room_no TEXT NOT NULL,
      to_bed_no TEXT NOT NULL,
      to_room_bed TEXT NOT NULL,
      handler_name TEXT NOT NULL,
      reason TEXT,
      changed_at DATETIME DEFAULT (datetime('now', '+8 hours')),
      created_at DATETIME DEFAULT (datetime('now', '+8 hours')),
      FOREIGN KEY (dormitory_record_id) REFERENCES dormitory_records(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_dormitory_room_changes_record_id ON dormitory_room_change_records(dormitory_record_id);
    CREATE INDEX IF NOT EXISTS idx_dormitory_room_changes_changed_at ON dormitory_room_change_records(changed_at);
  `);
}

function mapChange(row: {
  id: number;
  dormitory_record_id: number;
  employee_name: string;
  from_room_no: string | null;
  from_bed_no: string | null;
  from_room_bed: string | null;
  to_room_no: string;
  to_bed_no: string;
  to_room_bed: string;
  handler_name: string;
  reason: string | null;
  changed_at: string;
  created_at: string;
}): DormitoryRoomChangeRecord {
  return {
    id: row.id,
    dormitoryRecordId: row.dormitory_record_id,
    employeeName: row.employee_name,
    fromRoomNo: row.from_room_no,
    fromBedNo: row.from_bed_no,
    fromRoomBed: row.from_room_bed,
    toRoomNo: row.to_room_no,
    toBedNo: row.to_bed_no,
    toRoomBed: row.to_room_bed,
    handlerName: row.handler_name,
    reason: row.reason,
    changedAt: row.changed_at,
    createdAt: row.created_at,
  };
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

    ensureChangeTable();

    const { id } = await params;
    const rows = db.prepare(`
      SELECT *
      FROM dormitory_room_change_records
      WHERE dormitory_record_id = ?
      ORDER BY changed_at DESC, id DESC
    `).all(id) as Array<Parameters<typeof mapChange>[0]>;

    return NextResponse.json({ success: true, changes: rows.map(mapChange) });
  } catch (error) {
    console.error('Get dormitory room change records error:', error);
    return NextResponse.json({ success: false, error: '获取更换记录失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    ensureChangeTable();

    const { id } = await params;
    const body = await request.json();
    const roomNo = String(body?.roomNo || '').trim();
    const bedNo = String(body?.bedNo || '').trim();
    const roomBed = roomNo && bedNo ? `${roomNo}-${bedNo}` : '';
    const handlerName = String(body?.handlerName || '').trim();
    const reason = String(body?.reason || '').trim();

    if (!roomNo) {
      return NextResponse.json({ success: false, error: '请选择新房号' }, { status: 400 });
    }
    if (!bedNo) {
      return NextResponse.json({ success: false, error: '请选择新床号' }, { status: 400 });
    }
    if (!handlerName) {
      return NextResponse.json({ success: false, error: '请填写更换经办人' }, { status: 400 });
    }

    const row = db.prepare('SELECT * FROM dormitory_records WHERE id = ?').get(id) as DormitoryDbRow | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: '住宿记录不存在' }, { status: 404 });
    }

    const record = parseDormitoryRow(row);
    if (record.status !== '已入住') {
      return NextResponse.json({ success: false, error: '只有已入住记录可以更改房号' }, { status: 400 });
    }

    if (record.roomNo === roomNo && record.bedNo === bedNo) {
      return NextResponse.json({ success: false, error: '新房号和床号不能与当前一致' }, { status: 400 });
    }

    const bed = db.prepare(`
      SELECT b.id FROM dormitory_beds b
      JOIN dormitory_rooms r ON r.id = b.room_id
      WHERE r.room_no = ? AND b.bed_no = ?
    `).get(roomNo, bedNo);
    if (!bed) {
      return NextResponse.json({ success: false, error: '该房号下不存在这个床号' }, { status: 400 });
    }

    const occupied = db.prepare(`
      SELECT id, name FROM dormitory_records
      WHERE room_no = ?
        AND bed_no = ?
        AND id <> ?
        AND status IN ('已审核', '已入住')
      LIMIT 1
    `).get(roomNo, bedNo, id) as { id: number; name: string } | undefined;
    if (occupied) {
      return NextResponse.json({ success: false, error: `该床位已分配给：${occupied.name}` }, { status: 400 });
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`
        INSERT INTO dormitory_room_change_records (
          dormitory_record_id,
          employee_name,
          from_room_no,
          from_bed_no,
          from_room_bed,
          to_room_no,
          to_bed_no,
          to_room_bed,
          handler_name,
          reason
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        record.name,
        record.roomNo,
        record.bedNo,
        record.roomBed,
        roomNo,
        bedNo,
        roomBed,
        handlerName,
        reason || null,
      );

      db.prepare(`
        UPDATE dormitory_records
        SET room_no = ?,
            bed_no = ?,
            room_bed = ?,
            updated_at = datetime('now', '+8 hours')
        WHERE id = ?
      `).run(roomNo, bedNo, roomBed, id);

      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'administration',
      action: 'change-room',
      details: {
        dormitoryId: id,
        employeeName: record.name,
        fromRoomNo: record.roomNo,
        fromBedNo: record.bedNo,
        toRoomNo: roomNo,
        toBedNo: bedNo,
        handlerName,
        reason,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    const updated = db.prepare('SELECT * FROM dormitory_records WHERE id = ?').get(id) as DormitoryDbRow;
    const rows = db.prepare(`
      SELECT *
      FROM dormitory_room_change_records
      WHERE dormitory_record_id = ?
      ORDER BY changed_at DESC, id DESC
    `).all(id) as Array<Parameters<typeof mapChange>[0]>;

    return NextResponse.json({
      success: true,
      record: parseDormitoryRow(updated),
      changes: rows.map(mapChange),
      message: '房号更换成功',
    });
  } catch (error) {
    console.error('Change dormitory room error:', error);
    return NextResponse.json({ success: false, error: '更换房号失败' }, { status: 500 });
  }
}
