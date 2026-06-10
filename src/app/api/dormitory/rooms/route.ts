import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import type { DormitoryRoom } from '@/types/dormitory';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function ensureRoomColumns() {
  const columns = db.prepare("PRAGMA table_info(dormitory_rooms)").all() as { name: string }[];
  if (!columns.some(col => col.name === 'room_type')) {
    db.exec("ALTER TABLE dormitory_rooms ADD COLUMN room_type TEXT DEFAULT ''");
  }
}

function mapRoom(row: {
  id: number;
  room_no: string;
  capacity: number | null;
  room_type: string | null;
  remark: string | null;
  bed_count: number | null;
  occupied_count: number | null;
  created_at: string;
  updated_at: string | null;
}): DormitoryRoom {
  const capacity = Number(row.capacity || 0);
  const bedCount = Number(row.bed_count || 0);
  const occupiedCount = Number(row.occupied_count || 0);
  const effectiveCapacity = capacity || bedCount;

  return {
    id: row.id,
    roomNo: row.room_no,
    capacity,
    roomType: row.room_type,
    remark: row.remark,
    bedCount,
    occupiedCount,
    isFull: effectiveCapacity > 0 && occupiedCount >= effectiveCapacity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    ensureRoomColumns();

    const rows = db.prepare(`
      SELECT
        r.*,
        COUNT(DISTINCT b.id) as bed_count,
        COUNT(DISTINCT CASE WHEN dr.status = '已入住' THEN dr.id END) as occupied_count
      FROM dormitory_rooms r
      LEFT JOIN dormitory_beds b ON b.room_id = r.id
      LEFT JOIN dormitory_records dr ON dr.room_no = r.room_no AND dr.status = '已入住'
      GROUP BY r.id
      ORDER BY r.room_no ASC
    `).all() as Array<Parameters<typeof mapRoom>[0]>;

    return NextResponse.json({ success: true, rooms: rows.map(mapRoom) });
  } catch (error) {
    console.error('Get dormitory rooms error:', error);
    return NextResponse.json({ success: false, error: '获取房号失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const roomNo = String(body?.roomNo || '').trim();
    const capacity = Math.max(0, Number(body?.capacity || 0));
    const roomType = String(body?.roomType || '').trim();
    const remark = String(body?.remark || '').trim();

    if (!roomNo) {
      return NextResponse.json({ success: false, error: '请填写房号' }, { status: 400 });
    }

    ensureRoomColumns();

    const exists = db.prepare('SELECT id FROM dormitory_rooms WHERE room_no = ?').get(roomNo);
    if (exists) {
      return NextResponse.json({ success: false, error: '房号已存在' }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO dormitory_rooms (room_no, capacity, room_type, remark)
      VALUES (?, ?, ?, ?)
    `).run(roomNo, capacity, roomType, remark);

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'administration',
      action: 'create-room',
      details: { roomNo, capacity, roomType },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ success: true, message: '房号添加成功' });
  } catch (error) {
    console.error('Create dormitory room error:', error);
    return NextResponse.json({ success: false, error: '添加房号失败' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    ensureRoomColumns();

    const body = await request.json();
    const id = Number(body?.id || 0);
    const roomNo = String(body?.roomNo || '').trim();
    const capacity = Math.max(0, Number(body?.capacity || 0));
    const roomType = String(body?.roomType || '').trim();
    const remark = String(body?.remark || '').trim();

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少房号ID' }, { status: 400 });
    }
    if (!roomNo) {
      return NextResponse.json({ success: false, error: '请填写房号' }, { status: 400 });
    }

    const room = db.prepare('SELECT * FROM dormitory_rooms WHERE id = ?').get(id) as {
      id: number;
      room_no: string;
      capacity: number | null;
      room_type: string | null;
      remark: string | null;
    } | undefined;
    if (!room) {
      return NextResponse.json({ success: false, error: '房号不存在' }, { status: 404 });
    }

    const duplicate = db.prepare('SELECT id FROM dormitory_rooms WHERE room_no = ? AND id <> ?').get(roomNo, id);
    if (duplicate) {
      return NextResponse.json({ success: false, error: '房号已存在' }, { status: 400 });
    }

    const roomNoChanged = roomNo !== room.room_no;
    if (roomNoChanged) {
      const activeRecords = db.prepare(`
        SELECT COUNT(*) as count FROM dormitory_records
        WHERE room_no = ? AND status IN ('已审核', '已入住')
      `).get(room.room_no) as { count: number };
      if (activeRecords.count > 0) {
        return NextResponse.json({ success: false, error: '该房号已有审核或入住记录，不能直接改房号；请在已入住记录里使用“更改房号”' }, { status: 400 });
      }

      const waterRecords = db.prepare('SELECT COUNT(*) as count FROM water_meter_records WHERE room_no = ?').get(room.room_no) as { count: number };
      if (waterRecords.count > 0) {
        return NextResponse.json({ success: false, error: '该房号已有水表记录，不能直接改房号' }, { status: 400 });
      }
    }

    db.prepare(`
      UPDATE dormitory_rooms
      SET room_no = ?,
          capacity = ?,
          room_type = ?,
          remark = ?,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(roomNo, capacity, roomType, remark, id);

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'administration',
      action: 'update-room',
      details: {
        roomId: id,
        before: { roomNo: room.room_no, capacity: room.capacity, roomType: room.room_type, remark: room.remark },
        after: { roomNo, capacity, roomType, remark },
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ success: true, message: '房号修改成功' });
  } catch (error) {
    console.error('Update dormitory room error:', error);
    return NextResponse.json({ success: false, error: '修改房号失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少房号ID' }, { status: 400 });
    }

    const room = db.prepare('SELECT * FROM dormitory_rooms WHERE id = ?').get(id) as { room_no: string } | undefined;
    if (!room) {
      return NextResponse.json({ success: false, error: '房号不存在' }, { status: 404 });
    }

    const occupied = db.prepare(`
      SELECT COUNT(*) as count FROM dormitory_records
      WHERE room_no = ? AND status IN ('已审核', '已入住')
    `).get(room.room_no) as { count: number };
    if (occupied.count > 0) {
      return NextResponse.json({ success: false, error: '该房间已有住宿记录，不能删除' }, { status: 400 });
    }

    db.prepare('DELETE FROM dormitory_beds WHERE room_id = ?').run(id);
    db.prepare('DELETE FROM dormitory_rooms WHERE id = ?').run(id);

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'administration',
      action: 'delete-room',
      details: { roomId: id, roomNo: room.room_no },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ success: true, message: '房号删除成功' });
  } catch (error) {
    console.error('Delete dormitory room error:', error);
    return NextResponse.json({ success: false, error: '删除房号失败' }, { status: 500 });
  }
}
