import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { formatChinaDateTime } from '@/lib/china-time';

// 生成随机注册码
function generateRegistrationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 获取所有注册码
export async function GET(request: NextRequest) {
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
    
    const codes = query.getAllRegistrationCodes.all();
    return NextResponse.json({ success: true, codes });
  } catch (error) {
    console.error('获取注册码列表失败:', error);
    return NextResponse.json({ error: '获取注册码列表失败' }, { status: 500 });
  }
}

// 生成新注册码
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
    const { count = 1, permissions = [], expireHours = 24, departmentId, positionId } = body; // 生成数量、权限列表、有效期小时数、部门ID、职位ID
    
    const codes: string[] = [];
    const permissionsJson = JSON.stringify(permissions);
    
    // 计算过期时间
    let expiresAt: string | null = null;
    if (expireHours > 0) {
      const expireDate = new Date();
      expireDate.setHours(expireDate.getHours() + expireHours);
      expiresAt = formatChinaDateTime(expireDate);
    }
    
    for (let i = 0; i < Math.min(count, 10); i++) {
      const code = generateRegistrationCode();
      query.createRegistrationCode.run(code, user.id, expiresAt, permissionsJson, departmentId || null, positionId || null);
      codes.push(code);
    }
    
    return NextResponse.json({ 
      success: true, 
      codes,
      message: '注册码生成成功'
    });
  } catch (error) {
    console.error('生成注册码失败:', error);
    return NextResponse.json({ error: '生成注册码失败' }, { status: 500 });
  }
}

// 删除注册码
export async function DELETE(request: NextRequest) {
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
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: '注册码ID不能为空' }, { status: 400 });
    }
    
    query.deleteRegistrationCode.run(parseInt(id));
    
    return NextResponse.json({ success: true, message: '注册码删除成功' });
  } catch (error) {
    console.error('删除注册码失败:', error);
    return NextResponse.json({ error: '删除注册码失败' }, { status: 500 });
  }
}
