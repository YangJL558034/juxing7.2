import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { verifyToken } = await import('@/lib/auth');
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const userId = decoded.id;

    // 快速检查未读数量
    const result = query.notifications.getUnreadCount.get(userId) as { count: number } | undefined;

    return NextResponse.json({
      success: true,
      unreadCount: result?.count || 0
    });
  } catch (error) {
    console.error('获取未读数量失败:', error);
    return NextResponse.json({ error: '获取未读数量失败' }, { status: 500 });
  }
}
