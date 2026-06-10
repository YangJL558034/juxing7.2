import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query, logOperationServer } from '@/lib/database';
import { chinaNowSql } from '@/lib/china-time';

// 获取资产列表
export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);

  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    // 获取单个资产详情
    if (id) {
      const asset = query.getAssetById.get(id) as { config?: string } | undefined;
      if (asset && asset.config) {
        asset.config = JSON.parse(asset.config);
      }
      return NextResponse.json({ success: true, data: asset });
    }

    let assets;
    if (type) {
      assets = query.getAssetsByType.all(type);
    } else {
      assets = query.getAllAssets.all();
    }

    // 解析 config JSON
    const parsedAssets = (assets as { config?: string }[]).map(asset => ({
      ...asset,
      config: asset.config ? JSON.parse(asset.config) : null
    }));

    return NextResponse.json({ success: true, data: parsedAssets });
  } catch (error) {
    console.error('Get assets error:', error);
    return NextResponse.json({ success: false, error: '获取资产失败' }, { status: 500 });
  }
}

// 新增资产
export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);

  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { type, name, department, user: assetUser, value, purchase_date, config } = data;

    if (!type || !name) {
      return NextResponse.json({ success: false, error: '资产类型和名称不能为空' }, { status: 400 });
    }

    const status = assetUser ? '使用中' : '闲置';
    const configJson = config ? JSON.stringify(config) : null;
    
    // 如果有使用人，设置领用时间
    const claimTime = assetUser ? chinaNowSql() : null;
    
    const result = query.createAsset.run(
      type,
      name,
      department || null,
      assetUser || null,
      value || 0,
      purchase_date || null,
      status,
      configJson,
      claimTime
    );

    // 记录操作日志
    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'asset',
      action: 'create',
      details: { assetId: result.lastInsertRowid, type, name, department, assetUser },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ 
      success: true, 
      data: { id: result.lastInsertRowid, ...data, status, claimTime } 
    });
  } catch (error) {
    console.error('Create asset error:', error);
    return NextResponse.json({ success: false, error: '新增资产失败' }, { status: 500 });
  }
}

// 更新资产
export async function PUT(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);

  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { id, type, name, department, user: assetUser, value, purchase_date, config } = data;

    if (!id) {
      return NextResponse.json({ success: false, error: '资产ID不能为空' }, { status: 400 });
    }

    // 获取当前资产信息
    const currentAsset = query.getAssetById.get(id) as { user?: string, status?: string, claim_time?: string, name?: string } | undefined;
    
    // 自动计算状态
    let status = currentAsset?.status || '闲置';
    let claimTime = currentAsset?.claim_time || null;
    
    // 如果当前状态不是已报废，则根据使用人自动设置状态
    if (status !== '已报废') {
      status = assetUser ? '使用中' : '闲置';
    }
    
    // 如果使用人从空变为有值，设置领用时间
    if (!currentAsset?.user && assetUser) {
      claimTime = chinaNowSql();
    }
    // 如果使用人从有值变为空，清空领用时间
    else if (currentAsset?.user && !assetUser) {
      claimTime = null;
    }

    const configJson = config ? JSON.stringify(config) : null;
    query.updateAsset.run(type, name, department, assetUser || null, value, purchase_date, status, configJson, claimTime, id);

    // 记录操作日志
    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'asset',
      action: 'update',
      details: { assetId: id, name: currentAsset?.name || name, type, department, assetUser, status },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ success: true, data: { status, claimTime } });
  } catch (error) {
    console.error('Update asset error:', error);
    return NextResponse.json({ success: false, error: '更新资产失败' }, { status: 500 });
  }
}

// 删除资产
export async function DELETE(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUser(cookieHeader);

  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: '资产ID不能为空' }, { status: 400 });
    }

    // 获取资产信息用于日志
    const asset = query.getAssetById.get(id) as { name?: string, type?: string } | undefined;

    query.deleteAsset.run(id);

    // 记录操作日志
    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'asset',
      action: 'delete',
      details: { assetId: id, name: asset?.name, type: asset?.type },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete asset error:', error);
    return NextResponse.json({ success: false, error: '删除资产失败' }, { status: 500 });
  }
}
