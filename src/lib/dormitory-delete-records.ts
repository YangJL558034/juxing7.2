import { db } from '@/lib/database';
import type { DormitoryDeleteRecord } from '@/types/dormitory';
import { normalizeDormitoryData, parseDormitoryRow, type DormitoryDbRow } from '@/lib/dormitory-records';

export interface DormitoryDeleteDbRow {
  id: number;
  dormitory_record_id: number;
  employee_name: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  room_no: string | null;
  bed_no: string | null;
  room_bed: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  deleted_by_user_id: number | null;
  deleted_by_name: string;
  deleted_at: string;
  expires_at: string;
  record_snapshot: string | null;
  created_at: string;
}

export function ensureDormitoryDeleteRecordsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dormitory_delete_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dormitory_record_id INTEGER NOT NULL,
      employee_name TEXT NOT NULL,
      phone TEXT,
      department TEXT,
      position TEXT,
      room_no TEXT,
      bed_no TEXT,
      room_bed TEXT,
      checked_in_at DATETIME,
      checked_out_at DATETIME,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT NOT NULL,
      deleted_at DATETIME DEFAULT (datetime('now', '+8 hours')),
      record_snapshot TEXT,
      created_at DATETIME DEFAULT (datetime('now', '+8 hours'))
    );
    CREATE INDEX IF NOT EXISTS idx_dormitory_delete_records_deleted_at ON dormitory_delete_records(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_dormitory_delete_records_deleted_by ON dormitory_delete_records(deleted_by_user_id);
  `);

  const columns = db.prepare("PRAGMA table_info(dormitory_delete_records)").all() as { name: string }[];
  if (!columns.some(col => col.name === 'record_snapshot')) {
    db.exec('ALTER TABLE dormitory_delete_records ADD COLUMN record_snapshot TEXT');
  }
}

export function cleanupExpiredDormitoryDeleteRecords() {
  ensureDormitoryDeleteRecordsTable();
  return db.prepare("DELETE FROM dormitory_delete_records WHERE deleted_at < datetime('now', '+8 hours', '-1 month')").run();
}

export function mapDormitoryDeleteRecord(row: DormitoryDeleteDbRow): DormitoryDeleteRecord {
  return {
    id: row.id,
    dormitoryRecordId: row.dormitory_record_id,
    employeeName: row.employee_name,
    phone: row.phone,
    department: row.department,
    position: row.position,
    roomNo: row.room_no,
    bedNo: row.bed_no,
    roomBed: row.room_bed,
    checkedInAt: row.checked_in_at,
    checkedOutAt: row.checked_out_at,
    deletedByUserId: row.deleted_by_user_id,
    deletedByName: row.deleted_by_name,
    deletedAt: row.deleted_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function getDeleteRecordAsDormitoryRow(row: DormitoryDeleteDbRow): DormitoryDbRow {
  if (row.record_snapshot) {
    try {
      return JSON.parse(row.record_snapshot) as DormitoryDbRow;
    } catch {
      // Fall through to a minimal row for older delete records.
    }
  }

  const data = normalizeDormitoryData({
    name: row.employee_name,
    phone: row.phone || '',
    department: row.department || '',
    position: row.position || '',
    expectedCheckInDate: row.checked_in_at || '',
    reason: '已删除记录恢复',
    submittedDate: row.created_at || '',
    agreedToRules: true,
  });

  return {
    id: row.dormitory_record_id,
    status: '已退宿',
    name: row.employee_name,
    phone: row.phone,
    department: row.department,
    position: row.position,
    id_card: null,
    expected_check_in_date: row.checked_in_at,
    reason: data.reason,
    data_json: JSON.stringify(data),
    reviewer_name: null,
    review_opinion: null,
    reviewed_at: null,
    room_no: row.room_no,
    bed_no: row.bed_no,
    room_bed: row.room_bed,
    key_issued: null,
    handler_name: null,
    checked_in_at: row.checked_in_at,
    checkout_apply_date: row.checked_out_at,
    move_out_date: row.checked_out_at,
    checkout_reason: '已删除记录恢复',
    key_returned: null,
    checkout_handler_name: null,
    checked_out_at: row.checked_out_at,
    created_at: row.created_at,
    updated_at: null,
  };
}

export function getDeleteRecordAsDormitoryRecord(row: DormitoryDeleteDbRow) {
  return parseDormitoryRow(getDeleteRecordAsDormitoryRow(row));
}
