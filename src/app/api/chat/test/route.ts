import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const test = searchParams.get('test');
    
    console.log('Test API - 收到请求:', test);

    if (test === 'table') {
      // 检查表是否存在
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages'").all();
      console.log('Test API - 表查询结果:', tables);
      
      if (tables && (tables as any[]).length > 0) {
        // 检查表结构
        const columns = db.prepare("PRAGMA table_info(chat_messages)").all();
        console.log('Test API - 表结构:', columns);
        
        // 查询所有记录
        const allRecords = db.prepare("SELECT * FROM chat_messages").all();
        console.log('Test API - 所有记录:', allRecords);
        
        return NextResponse.json({ 
          success: true, 
          tableExists: true, 
          columns, 
          allRecords 
        });
      }
      return NextResponse.json({ success: true, tableExists: false, tables });
    }

    if (test === 'insert') {
      // 测试插入
      const result = db
        .prepare('INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)')
        .run(1, 'user', '测试消息');
      console.log('Test API - 插入结果:', result);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ success: true, message: '测试API运行中，请使用 ?test=table 或 ?test=insert' });
  } catch (error) {
    console.error('Test API - 出错:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}