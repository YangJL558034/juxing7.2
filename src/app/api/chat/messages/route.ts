import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

// 获取用户的聊天记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('API GET /chat/messages - 收到请求，userId:', userId);

    if (!userId) {
      console.log('API GET /chat/messages - 缺少用户ID');
      return NextResponse.json({ success: false, error: '用户ID不能为空' }, { status: 400 });
    }

    console.log('API GET /chat/messages - 查询数据库...');
    const messages = db
      .prepare('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC')
      .all(userId);

    console.log('API GET /chat/messages - 查询结果:', messages);
    return NextResponse.json({ success: true, messages });
  } catch (error) {
    console.error('API GET /chat/messages - 出错:', error);
    return NextResponse.json(
      { success: false, error: '获取聊天记录失败' },
      { status: 500 }
    );
  }
}

// 保存聊天消息
export async function POST(request: NextRequest) {
  try {
    const { userId, role, content } = await request.json();
    console.log('API POST /chat/messages - 收到请求:', { userId, role, contentLength: content?.length });

    if (!userId || !role || !content) {
      console.log('API POST /chat/messages - 缺少必要参数');
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    console.log('API POST /chat/messages - 插入数据库...');
    const result = db
      .prepare('INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)')
      .run(userId, role, content);

    console.log('API POST /chat/messages - 插入成功，messageId:', result.lastInsertRowid);
    return NextResponse.json({
      success: true,
      messageId: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('API POST /chat/messages - 出错:', error);
    return NextResponse.json(
      { success: false, error: '保存聊天记录失败' },
      { status: 500 }
    );
  }
}

// 清空用户的聊天记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('API DELETE /chat/messages - 收到请求，userId:', userId);

    if (!userId) {
      console.log('API DELETE /chat/messages - 缺少用户ID');
      return NextResponse.json(
        { success: false, error: '用户ID不能为空' },
        { status: 400 }
      );
    }

    console.log('API DELETE /chat/messages - 删除记录...');
    const result = db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(userId);
    console.log('API DELETE /chat/messages - 删除成功，影响行数:', result.changes);

    return NextResponse.json({ success: true, message: '聊天记录已清空' });
  } catch (error) {
    console.error('API DELETE /chat/messages - 出错:', error);
    return NextResponse.json(
      { success: false, error: '清空聊天记录失败' },
      { status: 500 }
    );
  }
}
