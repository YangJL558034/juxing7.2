/**
 * AI 助手配置管理 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    const config = db!.prepare('SELECT * FROM ai_config WHERE id = 1').get() as any;
    
    return NextResponse.json({
      success: true,
      config: config ? {
        deepSeekApiKey: config.deepseek_api_key || '',
        doubaoApiKey: config.doubao_api_key || '',
        doubaoSecret: config.doubao_secret || '',
        defaultProvider: config.default_provider || 'deepseek',
      } : {
        deepSeekApiKey: '',
        doubaoApiKey: '',
        doubaoSecret: '',
        defaultProvider: 'deepseek',
      }
    });
  } catch (error) {
    console.error('获取 AI 配置失败:', error);
    return NextResponse.json({ success: false, error: '获取配置失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('cookie')?.split('token=')[1]?.split(';')[0];
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
    
    const body = await request.json();
    const { deepSeekApiKey, doubaoApiKey, doubaoSecret, defaultProvider } = body;
    
    const existing = db!.prepare('SELECT id FROM ai_config WHERE id = 1').get();
    
    if (existing) {
      db!.prepare(`
        UPDATE ai_config
        SET deepseek_api_key = ?, doubao_api_key = ?, doubao_secret = ?, default_provider = ?, updated_at = datetime('now', '+8 hours')
        WHERE id = 1
      `).run(deepSeekApiKey || '', doubaoApiKey || '', doubaoSecret || '', defaultProvider || 'deepseek');
    } else {
      db!.prepare(`
        INSERT INTO ai_config (id, deepseek_api_key, doubao_api_key, doubao_secret, default_provider)
        VALUES (1, ?, ?, ?, ?)
      `).run(deepSeekApiKey || '', doubaoApiKey || '', doubaoSecret || '', defaultProvider || 'deepseek');
    }
    
    return NextResponse.json({ success: true, message: 'AI 配置保存成功' });
  } catch (error) {
    console.error('保存 AI 配置失败:', error);
    return NextResponse.json({ success: false, error: '保存配置失败' }, { status: 500 });
  }
}
