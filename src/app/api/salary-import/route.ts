import { NextRequest, NextResponse } from 'next/server';
import { db, query, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import * as XLSX from 'xlsx';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// 工资条Excel导入（支持车间和办公室两种格式）
export async function POST(request: NextRequest) {
  try {
    console.log('[Salary Import] 收到导入请求');
    
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      console.log('[Salary Import] 未登录');
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      console.log('[Salary Import] 登录已过期');
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const body = await request.json();
    const { filePath, location } = body;

    console.log('[Salary Import] 导入参数:', { filePath, location });

    if (!filePath || !existsSync(filePath)) {
      console.error('[Salary Import] 文件不存在:', filePath);
      return NextResponse.json({ error: '文件不存在' }, { status: 400 });
    }

    // 读取 Excel 文件
    const fileBuffer = await readFile(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    // 检测是哪种格式：办公室还是车间
    // 表头在第3行（索引2），子表头在第4行（索引3），数据从第6行（索引5）开始
    const headerRow2 = data[2] || [];  // 主表头
    const headerRow3 = data[3] || [];  // 子表头
    const headerText2 = headerRow2.join('');
    const headerText3 = headerRow3.join('');
    const allHeaderText = headerText2 + headerText3;
    
    // 车间格式特征：表头包含"是否全勤"、"法定节假加班"、"生产部"
    const isWorkshopFormat = allHeaderText.includes('是否全勤') || 
                             allHeaderText.includes('法定节假加班') ||
                             allHeaderText.includes('生产部');
    
    // 办公室格式特征：表头包含"基本工资+补贴项目"、"应领工资"、"应扣项目"
    const isOfficeFormat = !isWorkshopFormat && (
      allHeaderText.includes('基本工资+补贴项目') || 
      allHeaderText.includes('应领工资') ||
      allHeaderText.includes('绩效奖金') ||
      headerText2.includes('部门')
    );
    
    console.log('检测格式:', isOfficeFormat ? '办公室工资表' : '车间工资表', '表头:', allHeaderText.substring(0, 100));

    let year = body.year || new Date().getFullYear();
    let month = body.month || new Date().getMonth() + 1;
    
    console.log('导入参数年月:', year, month, '(从参数获取:', !!body.year, !!body.month, ')');
    
    const records: any[] = [];
    let insertedCount = 0;
    let updatedCount = 0;
    const skippedEmployees: string[] = []; // 记录被跳过的员工

    if (isOfficeFormat) {
      // ===== 办公室工资表格式 =====
      // 如果参数没有提供年月，则从Excel解析
      if (!body.year || !body.month) {
        const titleText = String(data[0]?.[1] || data[0]?.[0] || data[1]?.[0] || '');
        const yearMatch = titleText.match(/(\d{4})年/);
        const monthMatch = titleText.match(/(\d{1,2})月/);
        if (yearMatch) year = parseInt(yearMatch[1]);
        if (monthMatch) month = parseInt(monthMatch[1]);
      }

      // 表头在第3行（索引2），数据从第6行开始（索引5）
      for (let i = 5; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[1]) continue;

        const name = String(row[1]).trim();
        if (!name || name === '姓名' || name === '合计') continue;

        // 办公室工资表列映射
        const record = {
          name,
          department: row[4] || '',                        // 部门
          baseSalary: parseFloat(row[5]) || 0,            // 基本工资
          shouldAttendDays: parseFloat(row[6]) || 22,     // 正班应出勤天数D
          saturdayDays: parseFloat(row[7]) || 4,          // 当月周六天数D
          normalAttendanceDays: parseFloat(row[8]) || 0,  // 正班实际出勤天数D
          paidLeaveDays: parseFloat(row[9]) || 0,         // 本月已休带薪假D
          weekdayOvertime: parseFloat(row[10]) || 0,      // 平时加班时间H
          weekendOvertime: parseFloat(row[11]) || 0,      // 周末加班时间D
          holidayOvertime: parseFloat(row[12]) || 0,      // 法定日加班D
          normalPay: parseFloat(row[13]) || 0,            // 实际出勤工资
          holidayVacationPay: parseFloat(row[14]) || 0,   // 本月法定日休假工资
          weekdayOvertimePay: parseFloat(row[15]) || 0,   // 平时加班工资
          weekendOvertimePay: parseFloat(row[16]) || 0,   // 周末加班工资
          holidayOvertimePay: parseFloat(row[17]) || 0,   // 法定日加班工资
          performanceBonus: parseFloat(row[18]) || 0,     // 绩效奖金（浮动）
          mealSubsidy: parseFloat(row[19]) || 0,          // 用餐补贴
          housingSubsidy: parseFloat(row[20]) || 0,       // 住房补贴
          transportSubsidy: parseFloat(row[21]) || 0,     // 交通补贴
          subsidy: parseFloat(row[22]) || 0,              // 补贴
          fine: parseFloat(row[23]) || 0,                 // 罚款（负数）
          otherDeduct: parseFloat(row[24]) || 0,          // 其他扣款（负数）
          utilities: parseFloat(row[25]) || 0,            // 水电费
          totalPayable: parseFloat(row[26]) || 0,         // 应领工资
          housingFund: parseFloat(row[27]) || 0,          // 公积金
          socialInsurance: parseFloat(row[28]) || 0,      // 社会保险
          socialSecurityAdjust: parseFloat(row[29]) || 0, // 社保养老调
          socialSecuritySubsidy: parseFloat(row[30]) || 0,// 社保补贴
          preTaxSalary: parseFloat(row[31]) || 0,         // 税前工资
          incomeTax: parseFloat(row[32]) || 0,            // 个人所得税
          actualAmount: parseFloat(row[33]) || 0,         // 实发工资
          bankAccount: String(row[35] || '').split('（')[0], // 银行卡号
          remark: row[36] || '',                          // 备注
        };

        // 查找员工，只导入已存在的员工
        let employee = db.prepare('SELECT * FROM employees WHERE name = ?').get(name) as any;
        
        if (!employee) {
          // 员工不存在，跳过此记录
          console.log(`员工不存在，跳过: ${name}`);
          skippedEmployees.push(name);
          continue;
        }
        
        const employeeId = employee.id;
        updatedCount++;

        // 创建或更新月度工时记录
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        const existing = db.prepare(`
          SELECT * FROM work_hours_monthly WHERE employee_id = ? AND year = ? AND month_num = ?
        `).get(employeeId, year, month) as any;

        // 计算正班小时（天数 * 8）
        const normalHours = record.normalAttendanceDays * 8;

        if (existing) {
          db.prepare(`
            UPDATE work_hours_monthly SET 
              employee_name = ?, 
              normal_hours = ?, weekday_overtime = ?, weekend_overtime = ?,
              base_salary = ?, normal_pay = ?, weekday_overtime_pay = ?, weekend_overtime_pay = ?,
              total_payable = ?, deduction = ?, actual_amount = ?, location = ?,
              work_hours = ?, overtime_hours = ?,
              performance_allowance = ?, living_subsidy = ?, other_pay = ?,
              deduct_utilities = ?, total_deduction = ?,
              bank_account = ?, performance_pay = ?, holiday_overtime_pay = ?,
              department = ?, should_attend_days = ?, saturday_days = ?, actual_attend_days = ?,
              paid_leave_days = ?, holiday_overtime = ?, holiday_pay = ?, holiday_overtime_pay = ?,
              performance_bonus = ?, meal_subsidy = ?, housing_subsidy = ?, transport_subsidy = ?,
              other_subsidy = ?, fine = ?, other_deduction = ?,
              housing_fund = ?, social_insurance = ?, social_pension_adj = ?,
              social_security_subsidy = ?, pre_tax_salary = ?, income_tax = ?, remark = ?
            WHERE id = ?
          `).run(
            name, 
            normalHours, record.weekdayOvertime, record.weekendOvertime,
            record.baseSalary, record.normalPay, record.weekdayOvertimePay, record.weekendOvertimePay,
            record.totalPayable, record.socialInsurance + record.housingFund, record.actualAmount, location || '办公室',
            normalHours + record.weekdayOvertime, record.weekdayOvertime,
            record.performanceBonus, record.mealSubsidy, record.housingSubsidy + record.transportSubsidy,
            record.utilities, record.socialInsurance + record.housingFund,
            record.bankAccount, record.performanceBonus, record.holidayOvertimePay,
            record.department, record.shouldAttendDays, record.saturdayDays, record.normalAttendanceDays,
            record.paidLeaveDays, record.holidayOvertime, record.holidayVacationPay, record.holidayOvertimePay,
            record.performanceBonus, record.mealSubsidy, record.housingSubsidy, record.transportSubsidy,
            record.subsidy, record.fine, record.otherDeduct,
            record.housingFund, record.socialInsurance, record.socialSecurityAdjust,
            record.socialSecuritySubsidy, record.preTaxSalary, record.incomeTax, record.remark,
            existing.id
          );
        } else {
          db.prepare(`
            INSERT INTO work_hours_monthly (
              employee_id, month, total_days, work_hours, overtime_hours, weekend_overtime,
              details, employee_name, year, month_num, normal_hours, weekday_overtime,
              base_salary, normal_pay, weekday_overtime_pay, weekend_overtime_pay,
              total_payable, deduction, actual_amount, location,
              performance_allowance, living_subsidy, other_pay,
              deduct_utilities, total_deduction,
              bank_account, performance_pay, holiday_overtime_pay,
              department, should_attend_days, saturday_days, actual_attend_days,
              paid_leave_days, holiday_overtime, holiday_pay,
              performance_bonus, meal_subsidy, housing_subsidy, transport_subsidy,
              other_subsidy, fine, other_deduction,
              housing_fund, social_insurance, social_pension_adj,
              social_security_subsidy, pre_tax_salary, income_tax, remark
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `).run(
            employeeId, monthStr, record.normalAttendanceDays, 
            normalHours + record.weekdayOvertime, record.weekdayOvertime, record.weekendOvertime,
            JSON.stringify({ remark: record.remark }), name, year, month, normalHours, record.weekdayOvertime,
            record.baseSalary, record.normalPay, record.weekdayOvertimePay, record.weekendOvertimePay,
            record.totalPayable, record.socialInsurance + record.housingFund, record.actualAmount, location || '办公室',
            record.performanceBonus, record.mealSubsidy, record.housingSubsidy + record.transportSubsidy,
            record.utilities, record.socialInsurance + record.housingFund,
            record.bankAccount, record.performanceBonus, record.holidayOvertimePay,
            record.department, record.shouldAttendDays, record.saturdayDays, record.normalAttendanceDays,
            record.paidLeaveDays, record.holidayOvertime, record.holidayVacationPay,
            record.performanceBonus, record.mealSubsidy, record.housingSubsidy, record.transportSubsidy,
            record.subsidy, record.fine, record.otherDeduct,
            record.housingFund, record.socialInsurance, record.socialSecurityAdjust,
            record.socialSecuritySubsidy, record.preTaxSalary, record.incomeTax, record.remark
          );
        }

        records.push(record);
      }
    } else {
      // ===== 车间工资表格式 =====
      // 如果参数没有提供年月，则从Excel解析
      if (!body.year || !body.month) {
        for (let i = 0; i < Math.min(5, data.length); i++) {
          const row = data[i];
          if (row && row[0]) {
            const text = String(row[0]);
            const yearMatch = text.match(/(\d{4})年/);
            const monthMatch = text.match(/(\d{1,2})月/);
            if (yearMatch) year = parseInt(yearMatch[1]);
            if (monthMatch) month = parseInt(monthMatch[1]);
          }
        }
      }

      // 解析数据行（从第6行开始，前5行是表头）
      for (let i = 6; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[1]) continue;

        const name = String(row[1]).trim();
        if (!name || name === '姓名') continue;

        // 车间工资表列映射
        const record = {
          name,
          isFullAttendance: row[2] === '是' ? '是' : '否',
          idCard: row[3] || '',
          bankAccount: row[4] || '',
          bankName: row[5] || '',
          baseSalary: parseFloat(row[6]) || 0,
          performanceAllowance: parseFloat(row[7]) || 0,
          otherSubsidy: parseFloat(row[8]) || 0,
          requiredHours: parseFloat(row[9]) || 176,
          normalFullAttendance: parseFloat(row[10]) || 176,
          normalHours: parseFloat(row[11]) || 0,
          weekdayOvertime: parseFloat(row[12]) || 0,
          weekendOvertime: parseFloat(row[13]) || 0,
          holidayOvertime: parseFloat(row[14]) || 0,
          nightShift: parseFloat(row[15]) || 0,
          absentDays: parseFloat(row[16]) || 0,
          personalLeave: parseFloat(row[17]) || 0,
          sickLeave: parseFloat(row[18]) || 0,
          lateEarlyMinutes: parseFloat(row[19]) || 0,
          lateEarlyCount: parseFloat(row[20]) || 0,
          signCardCount: parseFloat(row[21]) || 0,
          evalCoeff: parseFloat(row[22]) || 1,
          normalPay: parseFloat(row[23]) || 0,
          performancePay: parseFloat(row[24]) || 0,
          weekdayOvertimePay: parseFloat(row[25]) || 0,
          weekendOvertimePay: parseFloat(row[26]) || 0,
          holidayOvertimePay: parseFloat(row[27]) || 0,
          sickPay: parseFloat(row[28]) || 0,
          livingSubsidy: parseFloat(row[29]) || 0,
          otherPay: parseFloat(row[30]) || 0,
          seniorityAward: parseFloat(row[31]) || 0,
          fullAttendanceAward: parseFloat(row[32]) || 0,
          positionSubsidy: parseFloat(row[33]) || 0,
          workReward: parseFloat(row[34]) || 0,
          springFestivalSubsidy: parseFloat(row[35]) || 0,
          socialSecuritySubsidy: parseFloat(row[36]) || 0,
          totalPayable: parseFloat(row[37]) || 0,
          deductSocialSecurity: parseFloat(row[38]) || 0,
          deductLoan: parseFloat(row[39]) || 0,
          deductUrgent: parseFloat(row[40]) || 0,
          deductOther: parseFloat(row[41]) || 0,
          deductUtilities: parseFloat(row[42]) || 0,
          totalDeduction: parseFloat(row[43]) || 0,
          actualAmount: parseFloat(row[44]) || 0,
        };

        // 查找员工，只导入已存在的员工
        let employee = db.prepare('SELECT * FROM employees WHERE name = ?').get(name) as any;
        
        if (!employee) {
          // 员工不存在，跳过此记录
          console.log(`员工不存在，跳过: ${name}`);
          skippedEmployees.push(name);
          continue;
        }
        
        const employeeId = employee.id;
        updatedCount++;

        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        const existing = db.prepare(`
          SELECT * FROM work_hours_monthly WHERE employee_id = ? AND year = ? AND month_num = ?
        `).get(employeeId, year, month) as any;

        if (existing) {
          db.prepare(`
            UPDATE work_hours_monthly SET 
              employee_name = ?, 
              normal_hours = ?, weekday_overtime = ?, weekend_overtime = ?,
              base_salary = ?, normal_pay = ?, weekday_overtime_pay = ?, weekend_overtime_pay = ?,
              total_payable = ?, deduction = ?, actual_amount = ?, location = ?,
              work_hours = ?, overtime_hours = ?,
              is_full_attendance = ?, id_card = ?, bank_account = ?, bank_name = ?,
              performance_allowance = ?, other_subsidy_base = ?, required_hours = ?, full_attendance_hours = ?,
              holiday_overtime_hours = ?, night_shift_days = ?, absent_days = ?,
              personal_leave_hours = ?, sick_leave_hours = ?, late_early_minutes = ?, late_early_count = ?,
              sign_card_count = ?, evaluation_coefficient = ?, performance_pay = ?, holiday_overtime_pay = ?,
              sick_pay = ?, living_subsidy = ?, other_pay = ?, seniority_award = ?, full_attendance_award = ?,
              position_subsidy = ?, work_reward = ?, spring_festival_subsidy = ?, social_security_subsidy = ?,
              deduct_social_security = ?, deduct_loan = ?, deduct_urgent = ?, deduct_other = ?,
              deduct_utilities = ?, total_deduction = ?
            WHERE id = ?
          `).run(
            name, 
            record.normalHours, record.weekdayOvertime, record.weekendOvertime,
            record.baseSalary, record.normalPay, record.weekdayOvertimePay, record.weekendOvertimePay,
            record.totalPayable, record.totalDeduction, record.actualAmount, location || '车间',
            record.normalHours + record.weekdayOvertime, record.weekdayOvertime,
            record.isFullAttendance, record.idCard, record.bankAccount, record.bankName,
            record.performanceAllowance, record.otherSubsidy, record.requiredHours, record.normalFullAttendance,
            record.holidayOvertime, record.nightShift, record.absentDays,
            record.personalLeave, record.sickLeave, record.lateEarlyMinutes, record.lateEarlyCount,
            record.signCardCount, record.evalCoeff, record.performancePay, record.holidayOvertimePay,
            record.sickPay, record.livingSubsidy, record.otherPay, record.seniorityAward, record.fullAttendanceAward,
            record.positionSubsidy, record.workReward, record.springFestivalSubsidy, record.socialSecuritySubsidy,
            record.deductSocialSecurity, record.deductLoan, record.deductUrgent, record.deductOther,
            record.deductUtilities, record.totalDeduction,
            existing.id
          );
        } else {
          db.prepare(`
            INSERT INTO work_hours_monthly (
              employee_id, month, total_days, work_hours, overtime_hours, weekend_overtime,
              details, employee_name, year, month_num, normal_hours, weekday_overtime,
              base_salary, normal_pay, weekday_overtime_pay, weekend_overtime_pay,
              total_payable, deduction, actual_amount, location,
              is_full_attendance, id_card, bank_account, bank_name,
              performance_allowance, other_subsidy_base, required_hours, full_attendance_hours,
              holiday_overtime_hours, night_shift_days, absent_days,
              personal_leave_hours, sick_leave_hours, late_early_minutes, late_early_count,
              sign_card_count, evaluation_coefficient, performance_pay, holiday_overtime_pay,
              sick_pay, living_subsidy, other_pay, seniority_award, full_attendance_award,
              position_subsidy, work_reward, spring_festival_subsidy, social_security_subsidy,
              deduct_social_security, deduct_loan, deduct_urgent, deduct_other,
              deduct_utilities, total_deduction
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `).run(
            employeeId, monthStr, Math.ceil(record.normalHours / 8), 
            record.normalHours + record.weekdayOvertime, record.weekdayOvertime, record.weekendOvertime,
            '{}', name, year, month, record.normalHours, record.weekdayOvertime,
            record.baseSalary, record.normalPay, record.weekdayOvertimePay, record.weekendOvertimePay,
            record.totalPayable, record.totalDeduction, record.actualAmount, location || '车间',
            record.isFullAttendance, record.idCard, record.bankAccount, record.bankName,
            record.performanceAllowance, record.otherSubsidy, record.requiredHours, record.normalFullAttendance,
            record.holidayOvertime, record.nightShift, record.absentDays,
            record.personalLeave, record.sickLeave, record.lateEarlyMinutes, record.lateEarlyCount,
            record.signCardCount, record.evalCoeff, record.performancePay, record.holidayOvertimePay,
            record.sickPay, record.livingSubsidy, record.otherPay, record.seniorityAward, record.fullAttendanceAward,
            record.positionSubsidy, record.workReward, record.springFestivalSubsidy, record.socialSecuritySubsidy,
            record.deductSocialSecurity, record.deductLoan, record.deductUrgent, record.deductOther,
            record.deductUtilities, record.totalDeduction
          );
        }

        records.push(record);
      }
    }

    // 记录操作日志
    logOperationServer({
      userId: decoded.id,
      userName: decoded.name || decoded.username,
      module: 'salary',
      action: 'import',
      details: {
        format: isOfficeFormat ? '办公室' : '车间',
        year,
        month,
        recordCount: records.length,
        skippedEmployees: skippedEmployees.slice(0, 10), // 最多记录10个
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({
      success: true,
      data: {
        format: isOfficeFormat ? '办公室' : '车间',
        year,
        month,
        location,
        records,
        updatedCount,
        skippedCount: skippedEmployees.length,
        skippedEmployees,
        total: records.length
      }
    });
  } catch (error) {
    console.error('Salary import error:', error);
    return NextResponse.json({ error: '导入失败：' + (error as Error).message }, { status: 500 });
  }
}
