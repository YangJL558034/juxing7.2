import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { getCurrentUser } from '@/lib/auth';
import { chinaNowSql } from '@/lib/china-time';

// 资产报废
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const assetId = parseInt(id);
    
    if (isNaN(assetId)) {
      return NextResponse.json({ error: '无效的资产ID' }, { status: 400 });
    }

    // 获取当前用户
    const cookieHeader = request.headers.get('cookie');
    const user = await getCurrentUser(cookieHeader);

    // 获取请求体中的确认人
    const body = await request.json();
    const { confirmer } = body;
    
    if (!confirmer || !confirmer.trim()) {
      return NextResponse.json({ error: '请填写报废确认人' }, { status: 400 });
    }

    // 检查资产是否存在
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId) as { name?: string, type?: string } | undefined;
    if (!asset) {
      return NextResponse.json({ error: '资产不存在' }, { status: 404 });
    }

    // 更新资产状态为报废，记录报废时间和确认人
    const scrapTime = chinaNowSql();

    db.prepare(`
      UPDATE assets 
      SET status = '已报废', scrap_time = ?, scrap_confirmer = ?
      WHERE id = ?
    `).run(scrapTime, confirmer.trim(), assetId);

    // 记录操作日志
    if (user) {
      logOperationServer({
        userId: user.id,
        userName: user.name || user.username,
        module: 'asset',
        action: 'update',
        details: { action: '报废', assetId, name: asset.name, type: asset.type, confirmer },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: '资产已报废',
      scrap_time: scrapTime,
      scrap_confirmer: confirmer.trim()
    });
  } catch (error) {
    console.error('资产报废失败:', error);
    return NextResponse.json({ error: '资产报废失败' }, { status: 500 });
  }
}
