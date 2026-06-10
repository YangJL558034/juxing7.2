import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { query } from '@/lib/database';
import { resolveEmployeeSalaryLocation } from '@/lib/employee-location';

export async function POST(request: NextRequest) {
  try {
    console.log('[Employee Import] 收到导入请求');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const location = formData.get('location') as string || '车间';

    console.log('[Employee Import] 参数:', { 
      fileName: file?.name, 
      fileSize: file?.size, 
      location 
    });

    if (!file) {
      console.log('[Employee Import] 没有上传文件');
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    // 读取文件
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

    console.log('[Employee Import] 文件解析完成:', {
      sheetCount: workbook.SheetNames.length,
      sheetName,
      rowCount: data.length
    });

    // 解析数据
    // 表头在第6行（索引6），数据从第7行开始
    // 列3: 合同状态, 列4: 部门, 列5: 姓名, 列7: 身份证号, 列8: 手机号, 列10: 性别, 列16: 状态
    const employees: {
      name: string;
      id_card: string;
      phone: string;
      department: string;
      status: string;
      gender: string;
    }[] = [];

    for (let i = 7; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 17) continue;

      const name = String(row[5] || '').trim();
      const idCard = String(row[7] || '').trim();
      const phone = String(row[8] || '').trim();
      const department = String(row[4] || '').trim();
      const contractStatus = String(row[3] || '').trim();
      const gender = String(row[10] || '').trim();
      const empStatus = String(row[19] || '').trim(); // 状态在列20（索引19）

      if (!name || !idCard) continue; // 跳过没有姓名或身份证的行

      // 确定状态：优先使用状态列，其次使用合同状态
      let status = '在职';
      if (empStatus === '离职' || contractStatus === '已离职') {
        status = '离职';
      } else if (empStatus === '在职' || contractStatus === '在职') {
        status = '在职';
      }

      employees.push({
        name,
        id_card: idCard,
        phone,
        department: department || '生产部',
        status,
        gender
      });
    }

    console.log('[Employee Import] 解析完成:', { employeeCount: employees.length });

    if (employees.length === 0) {
      console.log('[Employee Import] 未找到有效的员工数据');
      return NextResponse.json({ error: '未找到有效的员工数据' }, { status: 400 });
    }

    // 导入到数据库
    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    console.log('[Employee Import] 开始导入到数据库');
    for (const emp of employees) {
      try {
        const employeeLocation = resolveEmployeeSalaryLocation(emp.department, location);
        // 检查是否已存在（通过姓名+身份证）
        const existing = query.getEmployeeByNameAndIdCard.get(emp.name, emp.id_card) as { id: number } | undefined;
        
        if (existing) {
          // 更新
          query.updateEmployee.run(
            emp.name,
            emp.id_card,
            emp.phone,
            emp.department,
            '',
            0,
            emp.status,
            employeeLocation,
            existing.id
          );
          updated++;
        } else {
          // 新增
          query.createEmployee.run(
            emp.name,
            emp.id_card,
            emp.phone,
            emp.department,
            '',
            0,
            emp.status,
            '',
            employeeLocation,
            ''  // hire_date
          );
          imported++;
        }
      } catch (error) {
        console.error('[Employee Import] 导入失败:', emp.name, error);
        errors.push(`${emp.name} 导入失败`);
      }
    }

    console.log('[Employee Import] 导入完成:', { imported, updated, errors: errors.length });

    return NextResponse.json({
      success: true,
      message: `成功导入 ${imported} 条，更新 ${updated} 条员工记录`,
      imported,
      updated,
      total: employees.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('[Employee Import] 导入失败:', error);
    return NextResponse.json({ 
      error: '导入失败', 
      details: error instanceof Error ? error.message : '未知错误' 
    }, { status: 500 });
  }
}
