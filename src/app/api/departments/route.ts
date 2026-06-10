import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromHeader } from '@/lib/auth';
import { query } from '@/lib/database';
import { chinaNowSql } from '@/lib/china-time';

// 从请求中获取 token（优先从 Authorization header，其次从 Cookie）
function getToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }
  return getTokenFromHeader(request.headers.get('cookie'));
}

// 获取部门列表
export async function GET(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '无效的token' }, { status: 401 });
    }

    const departments = query.departments.getAll.all() as Array<Record<string, unknown>>;
    
    return NextResponse.json({ success: true, departments });
  } catch (error) {
    console.error('获取部门失败:', error);
    return NextResponse.json({ error: '获取部门失败' }, { status: 500 });
  }
}

// 创建部门
export async function POST(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '无效的token' }, { status: 401 });
    }

    const body = await request.json();
    const { name, parent_id, manager_id, manager_name, description } = body;

    if (!name) {
      return NextResponse.json({ error: '部门名称不能为空' }, { status: 400 });
    }

    const result = query.departments.create.run(
      name,
      parent_id || null,
      manager_id || null,
      manager_name || null,
      description || null
    );
    
    // 记录操作日志
    query.operationLogs.create.run(
      decoded.id,
      decoded.name || decoded.username,
      '部门管理',
      '创建部门',
      `创建部门：${name}`,
      request.headers.get('x-forwarded-for') || request.headers.get('remote-addr') || null,
      request.headers.get('user-agent') || null,
      chinaNowSql()
    );
    
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('创建部门失败:', error);
    return NextResponse.json({ error: '创建部门失败' }, { status: 500 });
  }
}
