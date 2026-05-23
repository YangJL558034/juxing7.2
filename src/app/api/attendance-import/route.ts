import { NextRequest, NextResponse } from 'next/server';
import { db, query } from '@/lib/database';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

// 解析打卡记录Excel并导入
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath: inputFilePath, location } = body;
    
    console.log('[Attendance Import] 收到导入请求:', { filePath: inputFilePath, location });
    
    if (!inputFilePath || !existsSync(inputFilePath)) {
      console.error('[Attendance Import] 文件不存在:', inputFilePath);
      return NextResponse.json({ error: '文件不存在' }, { status: 400 });
    }
    
    // 读取 Excel 文件
    const fileBuffer = await readFile(inputFilePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    // 获取第一个工作表
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 转换为 JSON 数据
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    
    // 从文件名或内容提取年月
    let year = new Date().getFullYear();
    let month = new Date().getMonth() + 1;
    
    // 先从文件名提取
    const fileName = path.basename(inputFilePath);
    const fileNameYearMonthMatch = fileName.match(/(\d{4})年?(\d{1,2})月?/);
    if (fileNameYearMonthMatch) {
      year = parseInt(fileNameYearMonthMatch[1]);
      month = parseInt(fileNameYearMonthMatch[2]);
    }
    
    // 解析打卡记录
    const records = parseExcelAttendance(jsonData, year, month);
    
    if (records.length === 0) {
      return NextResponse.json({ 
        error: '未能解析到打卡记录，请检查文件格式',
        sheetName,
        rowCount: jsonData.length
      }, { status: 400 });
    }
    
    // 导入数据
    const result = await importAttendanceRecords(records, location || '办公室');
    
    return NextResponse.json({
      success: true,
      message: `成功导入 ${result.createdEmployees} 名员工，${result.createdRecords} 条打卡记录`,
      data: {
        year,
        month,
        location: location || '办公室',
        total: records.length,
        employees: result.employees,
        records: result.records
      }
    });
  } catch (error) {
    console.error('Import attendance error:', error);
    return NextResponse.json({ error: '导入失败: ' + (error as Error).message }, { status: 500 });
  }
}

// 解析 Excel 中的打卡数据 - 支持员工刷卡记录表格式
function parseExcelAttendance(data: any[][], defaultYear: number, defaultMonth: number) {
  const records: any[] = [];
  let year = defaultYear;
  let month = defaultMonth;
  
  if (data.length < 5) return records;
  
  // 查找考勤日期行
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const rowStr = (data[i] as any[]).join('');
    // 匹配 "考勤日期：2026-04-01～2026-04-30" 格式
    const dateMatch = rowStr.match(/考勤日期[：:]\s*(\d{4})-(\d{2})-\d{2}/);
    if (dateMatch) {
      year = parseInt(dateMatch[1]);
      month = parseInt(dateMatch[2]);
      break;
    }
    // 也尝试匹配其他年月格式
    const yearMonthMatch = rowStr.match(/(\d{4})年?(\d{1,2})月?/);
    if (yearMonthMatch) {
      year = parseInt(yearMonthMatch[1]);
      month = parseInt(yearMonthMatch[2]);
    }
  }
  
  // 解析员工记录 - 格式：每3行为一个员工
  // 第N行：工号：, , 1, , 姓名：, 张, 部门：, 财务部
  // 第N+1行：1, 2, 3, ..., 30 (日期列头)
  // 第N+2行：每日打卡时间
  
  for (let i = 4; i < data.length - 2; i++) {
    const row = data[i] as any[];
    if (!row || !Array.isArray(row)) continue;
    
    const rowStr = row.join('');
    
    // 查找包含"工号："或"姓名："的行 - 这是员工信息行
    if (rowStr.includes('工号') || rowStr.includes('姓名')) {
      // 提取工号
      let employeeId = '';
      let name = '';
      let department = '';
      
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim();
        
        // 找到"工号："后面的数字
        if (cell.includes('工号')) {
          // 工号在后面几列
          for (let k = j + 1; k < Math.min(j + 4, row.length); k++) {
            const nextCell = String(row[k] || '').trim();
            if (/^\d+$/.test(nextCell) && nextCell.length <= 10) {
              employeeId = nextCell;
              break;
            }
          }
        }
        
        // 找到"姓名："后面的名字
        if (cell.includes('姓名')) {
          for (let k = j + 1; k < Math.min(j + 4, row.length); k++) {
            const nextCell = String(row[k] || '').trim();
            if (/^[\u4e00-\u9fa5]{2,4}$/.test(nextCell)) {
              name = nextCell;
              break;
            }
          }
        }
        
        // 找到"部门："后面的部门名
        if (cell.includes('部门')) {
          for (let k = j + 1; k < Math.min(j + 4, row.length); k++) {
            const nextCell = String(row[k] || '').trim();
            if (nextCell && /^[\u4e00-\u9fa5]+$/.test(nextCell) && nextCell.length >= 2 && nextCell.length <= 6) {
              department = nextCell;
              break;
            }
          }
        }
      }
      
      // 如果没有找到姓名，跳过
      if (!name) continue;
      
      // 检查下一行是否是日期行（包含1-30的数字）
      const nextRow = data[i + 1] as any[];
      let dateStartCol = -1;
      
      if (nextRow && Array.isArray(nextRow)) {
        // 查找日期列起始位置（找数字1）
        for (let j = 0; j < nextRow.length; j++) {
          if (String(nextRow[j]) === '1') {
            dateStartCol = j;
            break;
          }
        }
      }
      
      // 读取打卡数据行
      const dataRow = data[i + 2] as any[];
      if (!dataRow || !Array.isArray(dataRow)) continue;
      
      // 解析每日打卡记录
      const attendance: { [day: number]: string } = {};
      
      if (dateStartCol >= 0) {
        for (let j = dateStartCol; j < dataRow.length && (j - dateStartCol + 1) <= 31; j++) {
          const day = j - dateStartCol + 1;
          const cell = String(dataRow[j] || '').trim();
          if (cell && cell !== '-') {
            attendance[day] = cell;
          }
        }
      }
      
      if (Object.keys(attendance).length > 0) {
        records.push({ 
          employeeId, 
          name, 
          department: department || '办公室', 
          year, 
          month, 
          attendance 
        });
      }
      
      // 跳过已处理的两行
      i += 2;
    }
  }
  
  return records;
}

// 导入打卡记录到数据库
async function importAttendanceRecords(records: any[], location: string) {
  let createdEmployees = 0;
  let createdRecords = 0;
  const employees: any[] = [];
  const recordDetails: any[] = [];
  
  for (const record of records) {
    // 查找员工（不自动创建，只导入已存在的员工）
    const employee = db.prepare('SELECT * FROM employees WHERE name = ?').get(record.name) as any;
    
    if (!employee) {
      // 员工不存在，跳过此条记录
      console.log(`跳过: 员工 "${record.name}" 不在员工列表中`);
      continue;
    }
    
    employees.push({ 
      id: employee.id, 
      name: record.name, 
      department: record.department || '办公室'
    });
    
    // 计算工时统计
    let normalHours = 0;
    let overtimeHours = 0;
    let workDays = 0;
    
    for (const [day, value] of Object.entries(record.attendance)) {
      const val = String(value);
      // 解析打卡时间，计算工时
      // 格式可能是: "08:30\n11:37\n..." 多个时间用换行分隔
      // 或者 "09:00-18:00" 时间范围
      // 或者 "8" 直接工时数字
      // 或者 "√" 打勾
      
      if (val.includes('\n')) {
        // 多个打卡时间，计算工作时间
        const times = val.split('\n').map(t => t.trim()).filter(t => /^\d{1,2}:\d{2}$/.test(t));
        if (times.length >= 2) {
          // 取第一个时间作为上班时间，最后一个作为下班时间
          const startTime = parseTime(times[0]);
          const endTime = parseTime(times[times.length - 1]);
          if (startTime && endTime) {
            let hours = (endTime - startTime) / 60;
            
            // 减去午休时间（12:00-13:30 = 1.5小时）
            if (hours > 4) {
              hours -= 1.5;
            }
            
            if (hours > 0) {
              workDays++;
              if (hours <= 8) {
                normalHours += hours;
              } else {
                normalHours += 8;
                overtimeHours += (hours - 8);
              }
            }
          }
        }
      } else if (val.includes('-')) {
        // 时间范围格式 "09:00-18:00"
        const times = val.split('-');
        if (times.length === 2) {
          const start = parseTime(times[0]);
          const end = parseTime(times[1]);
          if (start && end) {
            let hours = (end - start) / 60;
            if (hours > 4) {
              hours -= 1.5; // 减去午休
            }
            if (hours > 0) {
              workDays++;
              if (hours <= 8) {
                normalHours += hours;
              } else {
                normalHours += 8;
                overtimeHours += (hours - 8);
              }
            }
          }
        }
      } else if (/^\d+(\.\d+)?$/.test(val)) {
        // 直接是工时数字
        const hours = parseFloat(val);
        workDays++;
        if (hours <= 8) {
          normalHours += hours;
        } else {
          normalHours += 8;
          overtimeHours += (hours - 8);
        }
      } else if (val === '√' || val === 'v' || val === 'V') {
        // 打勾表示正常出勤
        workDays++;
        normalHours += 8;
      }
    }
    
    // 检查是否已存在该月份的记录
    const existing = query.getWorkHoursMonthlyByYearMonth.all(record.year, record.month) as any[];
    const existingRecord = existing.find((r: any) => r.employee_id === employee.id);
    
    const monthStr = `${record.year}-${String(record.month).padStart(2, '0')}`;
    
    if (existingRecord) {
      // 更新记录 - 只更新工时数据，不修改工资数据
      db.prepare(`
        UPDATE work_hours_monthly SET 
          employee_name = ?, normal_hours = ?, weekday_overtime = ?,
          work_hours = ?, overtime_hours = ?, total_days = ?,
          details = ?
        WHERE id = ?
      `).run(
        record.name, normalHours, overtimeHours,
        normalHours + overtimeHours, overtimeHours, workDays,
        JSON.stringify(record.attendance),
        existingRecord.id
      );
    } else {
      // 创建新记录 - 只保存工时数据，工资为0（需要单独导入工资条）
      query.createWorkHoursMonthly.run(
        employee.id,
        monthStr,
        workDays,
        normalHours + overtimeHours,
        overtimeHours,
        0, // weekend_overtime
        JSON.stringify(record.attendance), // details
        record.name,
        record.year,
        record.month,
        normalHours,
        overtimeHours,
        0, // base_salary - 工资需要单独导入
        0, // normal_pay
        0, // weekday_overtime_pay
        0, // weekend_overtime_pay
        0, // total_payable
        0, // deduction
        0, // actual_amount
        location
      );
    }
    
    createdRecords++;
    recordDetails.push({
      name: record.name,
      employeeId: record.employeeId,
      department: record.department,
      year: record.year,
      month: record.month,
      normalHours: Math.round(normalHours * 10) / 10,
      overtimeHours: Math.round(overtimeHours * 10) / 10,
      workDays
    });
  }
  
  return { createdEmployees, createdRecords, employees, records: recordDetails };
}

// 解析时间字符串为分钟数
function parseTime(timeStr: string): number | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
  return null;
}

// 获取打卡记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    
    let records;
    if (year && month) {
      records = query.getWorkHoursMonthlyByYearMonth.all(parseInt(year), parseInt(month));
    } else {
      records = query.getWorkHoursMonthly.all();
    }
    
    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error('Get attendance error:', error);
    return NextResponse.json({ error: '获取打卡记录失败' }, { status: 500 });
  }
}
