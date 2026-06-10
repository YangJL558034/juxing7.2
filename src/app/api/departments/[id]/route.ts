import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromHeader } from '@/lib/auth';
import { query } from '@/lib/database';
import { chinaNowSql } from '@/lib/china-time';

function getToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }
  return getTokenFromHeader(request.headers.get('cookie'));
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '无效的token' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, parent_id, manager_id, manager_name, description } = body;

    if (!name) {
      return NextResponse.json({ error: '部门名称不能为空' }, { status: 400 });
    }

    query.departments.update.run(
      name,
      parent_id || null,
      manager_id || null,
      manager_name || null,
      description || null,
      parseInt(id)
    );

    query.operationLogs.create.run(
      decoded.id,
      decoded.name || decoded.username,
      '部门管理',
      '编辑部门',
      `编辑部门：${name}`,
      request.headers.get('x-forwarded-for') || request.headers.get('remote-addr') || null,
      request.headers.get('user-agent') || null,
      chinaNowSql()
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('编辑部门失败:', error);
    return NextResponse.json({ error: '编辑部门失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '无效的token' }, { status: 401 });
    }

    const { id } = await params;
    
    const dept = query.departments.getById.get(parseInt(id)) as { name?: string };
    const deptName = dept?.name || '未知部门';

    const hasChildren = query.departments.getByParent.all(parseInt(id)) as Array<unknown>;
    if (hasChildren.length > 0) {
      return NextResponse.json({ error: '请先删除子部门' }, { status: 400 });
    }

    query.departments.delete.run(parseInt(id));

    query.operationLogs.create.run(
      decoded.id,
      decoded.name || decoded.username,
      '部门管理',
      '删除部门',
      `删除部门：${deptName}`,
      request.headers.get('x-forwarded-for') || request.headers.get('remote-addr') || null,
      request.headers.get('user-agent') || null,
      chinaNowSql()
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除部门失败:', error);
    return NextResponse.json({ error: '删除部门失败' }, { status: 500 });
  }
}
