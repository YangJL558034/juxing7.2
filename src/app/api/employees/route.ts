import { NextRequest, NextResponse } from 'next/server';
import { query, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { resolveEmployeeSalaryLocation } from '@/lib/employee-location';

// 获取员工列表
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const employees = query.getAllEmployees.all();

    return NextResponse.json({ success: true, data: employees });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json({ error: '获取员工列表失败' }, { status: 500 });
  }
}

// 创建员工
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const body = await request.json();
    const { name, id_card, phone, department, position, base_salary, status, location, hire_date } = body;
    const employeeLocation = resolveEmployeeSalaryLocation(department, location);

    if (!name) {
      return NextResponse.json({ error: '姓名为必填项' }, { status: 400 });
    }

    // 检查姓名是否已存在
    const existing = query.getEmployeeByNameAndIdCard.get(name, id_card || '');
    if (existing) {
      return NextResponse.json({ error: '该员工已存在' }, { status: 400 });
    }

    query.createEmployee.run(
      name,
      id_card || '',
      phone || '',
      department || '',
      position || '',
      base_salary || 0,
      status || '在职',
      '',
      employeeLocation,
      hire_date || null
    );

    // 记录操作日志
    logOperationServer({
      userId: decoded.id,
      userName: decoded.name || decoded.username,
      module: 'employee',
      action: 'create',
      details: { name, department, position, status, location: employeeLocation },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({ 
      success: true, 
      message: '员工创建成功' 
    });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json({ error: '创建员工失败' }, { status: 500 });
  }
}
