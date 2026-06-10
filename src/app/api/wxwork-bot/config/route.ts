/**
 * 企业微信机器人配置管理
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';

// 获取配置
export async function GET(request: NextRequest) {
  try {
    const config = db!.prepare('SELECT * FROM wxwork_bot_config WHERE id = 1').get() as any;
    
    return NextResponse.json({
      success: true,
      config: config ? {
        botId: config.bot_id || '',
        botSecret: config.bot_secret || '',
        apiUrl: config.api_url || '',
        authToken: config.auth_token || '',
        deepSeekApiKey: config.deepseek_api_key || '',
        enabled: config.enabled === 1,
      } : {
        botId: '',
        botSecret: '',
        apiUrl: '',
        authToken: '',
        deepSeekApiKey: '',
        enabled: false,
      }
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    return NextResponse.json({ success: false, error: '获取配置失败' }, { status: 500 });
  }
}

// 保存配置
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const token = request.headers.get('cookie')?.split('token=')[1]?.split(';')[0];
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
    
    const body = await request.json();
    const { botId, botSecret, apiUrl, authToken, deepSeekApiKey, enabled } = body;
    
    // 检查记录是否存在
    const existing = db!.prepare('SELECT id FROM wxwork_bot_config WHERE id = 1').get();
    
    if (existing) {
      // 更新现有记录
      db!.prepare(`
        UPDATE wxwork_bot_config
        SET bot_id = ?, bot_secret = ?, api_url = ?, auth_token = ?, deepseek_api_key = ?, enabled = ?, updated_at = datetime('now', '+8 hours')
        WHERE id = 1
      `).run(botId || '', botSecret || '', apiUrl || '', authToken || '', deepSeekApiKey || '', enabled ? 1 : 0);
    } else {
      // 插入新记录
      db!.prepare(`
        INSERT INTO wxwork_bot_config (id, bot_id, bot_secret, api_url, auth_token, deepseek_api_key, enabled)
        VALUES (1, ?, ?, ?, ?, ?, ?)
      `).run(botId || '', botSecret || '', apiUrl || '', authToken || '', deepSeekApiKey || '', enabled ? 1 : 0);
    }
    
    return NextResponse.json({ success: true, message: '配置保存成功' });
  } catch (error) {
    console.error('保存配置失败:', error);
    return NextResponse.json({ success: false, error: '保存配置失败' }, { status: 500 });
  }
}
