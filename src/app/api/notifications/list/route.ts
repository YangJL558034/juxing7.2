import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

// 获取所有通知列表（管理员用）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    // 获取通知总数
    const countResult = query.notifications.getAllCount.get() as { count: number };
    const total = countResult.count;

    // 获取通知列表
    const notifications = query.notifications.getAll.all(pageSize, offset) as Array<{
      id: number;
      title: string;
      content: string;
      sender_id: number;
      sender_name: string;
      receiver_id: number;
      receiver_name: string;
      is_read: number;
      read_at: string | null;
      email_sent: number;
      email_error: string | null;
      created_at: string;
      type: string;
      attachment_file: string | null;
      attachment_file_name: string | null;
    }>;

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('获取通知列表失败:', error);
    return NextResponse.json({ error: '获取通知列表失败' }, { status: 500 });
  }
}
