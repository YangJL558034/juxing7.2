import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import * as XLSX from 'xlsx';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

type CellValue = string | number | boolean | Date | null | undefined;
type LocationKey = 'office' | 'workshop';
type SalaryFormat = LocationKey;
type SqlValue = string | number | null;

type EmployeeRow = {
  id: number;
  name: string;
  department?: string | null;
  status?: string | null;
  location?: string | null;
};

type MonthlyRecordRow = {
  id: number;
};

type OfficeSalaryRecord = {
  name: string;
  department: string;
  baseSalary: number;
  shouldAttendDays: number;
  saturdayDays: number;
  normalAttendanceDays: number;
  paidLeaveDays: number;
  weekdayOvertime: number;
  weekendOvertime: number;
  holidayOvertime: number;
  normalPay: number;
  holidayVacationPay: number;
  weekdayOvertimePay: number;
  weekendOvertimePay: number;
  holidayOvertimePay: number;
  performanceBonus: number;
  mealSubsidy: number;
  housingSubsidy: number;
  transportSubsidy: number;
  subsidy: number;
  fine: number;
  otherDeduct: number;
  utilities: number;
  totalPayable: number;
  housingFund: number;
  socialInsurance: number;
  socialSecurityAdjust: number;
  socialSecuritySubsidy: number;
  preTaxSalary: number;
  incomeTax: number;
  actualAmount: number;
  bankAccount: string;
  remark: string;
};

type WorkshopSalaryRecord = {
  name: string;
  isFullAttendance: string;
  idCard: string;
  bankAccount: string;
  bankName: string;
  baseSalary: number;
  performanceAllowance: number;
  otherSubsidy: number;
  requiredHours: number;
  normalFullAttendance: number;
  normalHours: number;
  weekdayOvertime: number;
  weekendOvertime: number;
  holidayOvertime: number;
  nightShift: number;
  absentDays: number;
  personalLeave: number;
  sickLeave: number;
  lateEarlyMinutes: number;
  lateEarlyCount: number;
  signCardCount: number;
  evalCoeff: number;
  normalPay: number;
  performancePay: number;
  weekdayOvertimePay: number;
  weekendOvertimePay: number;
  holidayOvertimePay: number;
  sickPay: number;
  livingSubsidy: number;
  otherPay: number;
  seniorityAward: number;
  fullAttendanceAward: number;
  positionSubsidy: number;
  workReward: number;
  springFestivalSubsidy: number;
  socialSecuritySubsidy: number;
  totalPayable: number;
  deductSocialSecurity: number;
  deductLoan: number;
  deductUrgent: number;
  deductOther: number;
  deductUtilities: number;
  totalDeduction: number;
  actualAmount: number;
};

type ParsedSalaryRecord = OfficeSalaryRecord | WorkshopSalaryRecord;

type SkippedEmployee = {
  name: string;
  reason: string;
  status?: string;
  location?: string;
};

type YearMonth = {
  year: number;
  month: number;
  source: 'file' | 'request';
  requestMismatch: boolean;
};

export async function POST(request: NextRequest) {
  try {
    console.log('[Salary Import] 收到导入请求');

    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const body = await request.json();
    const { filePath } = body;

    if (!filePath || !existsSync(filePath)) {
      return NextResponse.json({ error: '文件不存在' }, { status: 400 });
    }

    const fileName = path.basename(filePath);
    const fileBuffer = await readFile(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return NextResponse.json({ error: '未找到可导入的工作表' }, { status: 400 });
    }

    const data = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as CellValue[][];

    const salaryFormat = detectSalaryFormat(workbook, data);
    if (!salaryFormat) {
      return NextResponse.json({
        error: '未识别工资表格式，请确认上传的是办公室工资表或车间工资表模板',
        sheetName,
      }, { status: 400 });
    }

    const locationKey = salaryFormat;
    const importLocation = displayLocation(locationKey);
    const yearMonth = resolveYearMonth(body, fileName, sheetName, data);

    if (!yearMonth) {
      return NextResponse.json({
        error: '未识别工资月份，请检查文件名或工资表标题是否包含年份和月份',
      }, { status: 400 });
    }

    const templateValidation = validateSalaryTemplate(data, salaryFormat);
    if (templateValidation.missingColumns.length > 0) {
      return NextResponse.json({
        error: `${importLocation}工资表模板关键表头缺失，已停止导入，避免导入错列`,
        data: {
          format: importLocation,
          sheetName,
          missingColumns: templateValidation.missingColumns,
          detectedHeaders: templateValidation.detectedHeaders,
        },
      }, { status: 400 });
    }

    const parsedRecords = salaryFormat === 'office'
      ? parseOfficeSalaryRows(data)
      : parseWorkshopSalaryRows(data);

    if (parsedRecords.length === 0) {
      return NextResponse.json({
        error: `${importLocation}工资表未解析到员工工资记录，请检查模板格式`,
        data: {
          format: importLocation,
          year: yearMonth.year,
          month: yearMonth.month,
          location: importLocation,
          parsed: 0,
        },
      }, { status: 400 });
    }

    const validationIssues = validateParsedSalaryRecords(parsedRecords, salaryFormat);
    if (validationIssues.length > 0) {
      return NextResponse.json({
        error: `${importLocation}工资表金额校验未通过，已停止导入，请先检查工资表`,
        data: {
          format: importLocation,
          year: yearMonth.year,
          month: yearMonth.month,
          parsed: parsedRecords.length,
          issueCount: validationIssues.length,
          issues: validationIssues.slice(0, 20),
        },
      }, { status: 400 });
    }

    const result = salaryFormat === 'office'
      ? importOfficeSalaryRecords(parsedRecords as OfficeSalaryRecord[], yearMonth.year, yearMonth.month, locationKey)
      : importWorkshopSalaryRecords(parsedRecords as WorkshopSalaryRecord[], yearMonth.year, yearMonth.month, locationKey);

    if (result.records.length === 0) {
      return NextResponse.json({
        error: `未导入任何员工：员工管理中没有匹配的${importLocation}在职员工`,
        data: {
          format: importLocation,
          year: yearMonth.year,
          month: yearMonth.month,
          location: importLocation,
          parsed: parsedRecords.length,
          imported: 0,
          skippedCount: result.skippedEmployees.length,
          skippedEmployees: result.skippedEmployees,
          skipped: result.skipped,
        },
      }, { status: 400 });
    }

    logOperationServer({
      userId: decoded.id,
      userName: decoded.name || decoded.username,
      module: 'salary',
      action: 'import',
      details: {
        format: importLocation,
        year: yearMonth.year,
        month: yearMonth.month,
        monthSource: yearMonth.source,
        requestMismatch: yearMonth.requestMismatch,
        parsedCount: parsedRecords.length,
        recordCount: result.records.length,
        skippedEmployees: result.skippedEmployees.slice(0, 10),
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({
      success: true,
      data: {
        format: importLocation,
        year: yearMonth.year,
        month: yearMonth.month,
        location: importLocation,
        records: result.records,
        insertedCount: result.insertedCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedEmployees.length,
        skippedEmployees: result.skippedEmployees,
        skipped: result.skipped,
        total: result.records.length,
        parsed: parsedRecords.length,
        monthSource: yearMonth.source,
      },
    });
  } catch (error) {
    console.error('Salary import error:', error);
    return NextResponse.json({ error: '导入失败：' + (error as Error).message }, { status: 500 });
  }
}

function detectSalaryFormat(workbook: XLSX.WorkBook, data: CellValue[][]): SalaryFormat | null {
  const sheetNameText = normalizeText(workbook.SheetNames.join(' '));
  if (
    sheetNameText.includes('员工刷卡记录表') ||
    (sheetNameText.includes('排班信息') && sheetNameText.includes('考勤记录'))
  ) {
    return null;
  }

  const searchableText = normalizeText([
    workbook.SheetNames.join(' '),
    ...data.slice(0, 12).map((row) => row.map(cellText).join(' ')),
  ].join(' '));

  if (
    searchableText.includes('是否全勤') ||
    searchableText.includes('应出勤小时') ||
    searchableText.includes('正班满勤小时') ||
    searchableText.includes('月度出勤记录')
  ) {
    return 'workshop';
  }

  if (
    searchableText.includes('考勤记录（天') ||
    searchableText.includes('考勤记录(天') ||
    searchableText.includes('正班应出勤天数') ||
    searchableText.includes('基本工资') ||
    searchableText.includes('绩效奖金') ||
    searchableText.includes('应领工资')
  ) {
    return 'office';
  }

  return null;
}

type ColumnLookup = {
  firstDataRowIndex: number;
  labels: string[];
  find: (aliases: string[], fallback?: number, occurrence?: number) => number;
};

type ColumnRequirement = {
  label: string;
  aliases: string[];
  occurrence?: number;
};

type SalaryValidationIssue = {
  name: string;
  field: string;
  message: string;
};

function resolveYearMonth(body: Record<string, unknown>, fileName: string, sheetName: string, data: CellValue[][]): YearMonth | null {
  const inferred = extractYearMonth(fileName, sheetName, data);
  const requestYear = toValidYear(body.year);
  const requestMonth = toValidMonth(body.month);

  if (inferred) {
    return {
      ...inferred,
      source: 'file',
      requestMismatch: Boolean(
        requestYear &&
        requestMonth &&
        (requestYear !== inferred.year || requestMonth !== inferred.month),
      ),
    };
  }

  if (requestYear && requestMonth) {
    return {
      year: requestYear,
      month: requestMonth,
      source: 'request',
      requestMismatch: false,
    };
  }

  return null;
}

function extractYearMonth(fileName: string, sheetName: string, data: CellValue[][]) {
  const candidates = [
    fileName,
    sheetName,
    ...data.slice(0, 10).map((row) => row.map(cellText).join(' ')),
  ];

  for (const candidate of candidates) {
    const text = normalizeText(candidate);
    const chineseMatch = text.match(/(20\d{2})年?(\d{1,2})月/);
    if (chineseMatch) {
      const year = toValidYear(chineseMatch[1]);
      const month = toValidMonth(chineseMatch[2]);
      if (year && month) {
        return { year, month };
      }
    }

    const compactMatch = text.match(/(20\d{2})(0[1-9]|1[0-2])月?/);
    if (compactMatch) {
      const year = toValidYear(compactMatch[1]);
      const month = toValidMonth(compactMatch[2]);
      if (year && month) {
        return { year, month };
      }
    }

    const shortSheetMatch = text.match(/(?:^|[^\d])(\d{2})-(\d{1,2})(?:$|[^\d])/);
    if (shortSheetMatch) {
      const year = toValidYear(`20${shortSheetMatch[1]}`);
      const month = toValidMonth(shortSheetMatch[2]);
      if (year && month) {
        return { year, month };
      }
    }
  }

  return null;
}

function createSalaryColumnLookup(data: CellValue[][]): ColumnLookup {
  const firstDataRowIndex = data.findIndex((row) => isLikelySalaryDataRow(row));
  const headerEnd = firstDataRowIndex >= 0 ? firstDataRowIndex : Math.min(data.length, 8);
  const headerRows = data.slice(0, headerEnd);
  const maxColumns = Math.max(
    0,
    ...headerRows.map((row) => row.length),
    ...data.slice(0, Math.max(headerEnd + 1, 8)).map((row) => row.length),
  );
  const labels = Array.from({ length: maxColumns }, (_, columnIndex) => (
    headerRows
      .map((row) => cellText(row[columnIndex]))
      .filter(Boolean)
      .join('')
  ));
  const normalizedLabels = labels.map(normalizeHeaderText);

  return {
    firstDataRowIndex,
    labels,
    find(aliases: string[], fallback = -1, occurrence = 0) {
      const normalizedAliases = aliases.map(normalizeHeaderText).filter(Boolean);
      if (normalizedAliases.length === 0) {
        return fallback;
      }

      const findMatch = (matcher: (label: string, alias: string) => boolean) => {
        const matches: number[] = [];
        normalizedLabels.forEach((label, index) => {
          if (label && normalizedAliases.some((alias) => matcher(label, alias))) {
            matches.push(index);
          }
        });
        return matches[occurrence] ?? -1;
      };

      const exactColumn = findMatch((label, alias) => label === alias);
      if (exactColumn >= 0) {
        return exactColumn;
      }

      const endingColumn = findMatch((label, alias) => label.endsWith(alias));
      if (endingColumn >= 0) {
        return endingColumn;
      }

      const containingColumn = findMatch((label, alias) => label.includes(alias));
      if (containingColumn >= 0) {
        return containingColumn;
      }

      return fallback;
    },
  };
}

function columnValue(row: CellValue[], lookup: ColumnLookup, aliases: string[], fallback = -1, occurrence = 0) {
  const column = lookup.find(aliases, fallback, occurrence);
  return column >= 0 ? row[column] : '';
}

function textByColumn(row: CellValue[], lookup: ColumnLookup, aliases: string[], fallback = -1, occurrence = 0) {
  return cellText(columnValue(row, lookup, aliases, fallback, occurrence));
}

function numberByColumn(row: CellValue[], lookup: ColumnLookup, aliases: string[], fallback = -1, defaultValue = 0, occurrence = 0) {
  return parseNumber(columnValue(row, lookup, aliases, fallback, occurrence), defaultValue);
}

function cleanBankAccount(value: CellValue) {
  return cellText(value).split(/[（(]/)[0].trim();
}

function validateSalaryTemplate(data: CellValue[][], format: SalaryFormat) {
  const lookup = createSalaryColumnLookup(data);
  const requiredColumns: Record<SalaryFormat, ColumnRequirement[]> = {
    office: [
      { label: '姓名', aliases: ['姓名'] },
      { label: '部门', aliases: ['部门'] },
      { label: '基本工资', aliases: ['基本工资'] },
      { label: '正班实际出勤天数', aliases: ['正班实际出勤天数', '实际出勤天数'] },
      { label: '应领工资', aliases: ['应领工资'] },
      { label: '税前工资', aliases: ['税前工资'] },
      { label: '个人所得税', aliases: ['个人所得税'] },
      { label: '实发工资', aliases: ['实发工资'] },
    ],
    workshop: [
      { label: '姓名', aliases: ['姓名'] },
      { label: '是否全勤', aliases: ['是否全勤'] },
      { label: '底薪', aliases: ['底薪', '基本工资'] },
      { label: '应出勤小时', aliases: ['应出勤小时'] },
      { label: '正班小时', aliases: ['正班小时'] },
      { label: '平时加班小时', aliases: ['平时加班小时'] },
      { label: '周末加班小时', aliases: ['周末加班小时'] },
      { label: '实际正班出勤工资', aliases: ['实际正班出勤工资'] },
      { label: '平时加班工资', aliases: ['平时加班工资'] },
      { label: '周末加班工资', aliases: ['周末加班工资'] },
      { label: '应付工资合计', aliases: ['应付工资合计'] },
      { label: '应扣款合计', aliases: ['应扣款合计'] },
      { label: '实发金额', aliases: ['实发金额', '实发工资'] },
    ],
  };

  const missingColumns = requiredColumns[format]
    .filter((requirement) => (
      lookup.find(requirement.aliases, -1, requirement.occurrence ?? 0) < 0
    ))
    .map((requirement) => requirement.label);

  return {
    missingColumns,
    detectedHeaders: lookup.labels.filter(Boolean),
  };
}

function validateParsedSalaryRecords(records: ParsedSalaryRecord[], format: SalaryFormat) {
  return format === 'office'
    ? validateOfficeSalaryRecords(records as OfficeSalaryRecord[])
    : validateWorkshopSalaryRecords(records as WorkshopSalaryRecord[]);
}

function validateOfficeSalaryRecords(records: OfficeSalaryRecord[]) {
  const issues: SalaryValidationIssue[] = [];

  for (const record of records) {
    if (record.actualAmount === 0 && record.totalPayable === 0) {
      continue;
    }

    const expectedActual = record.preTaxSalary - record.incomeTax;
    if (!amountsClose(record.actualAmount, expectedActual)) {
      issues.push({
        name: record.name,
        field: '实发工资',
        message: `实发工资 ${formatNumber(record.actualAmount)} 与 税前工资-个人所得税 ${formatNumber(expectedActual)} 不一致`,
      });
    }
  }

  return issues;
}

function validateWorkshopSalaryRecords(records: WorkshopSalaryRecord[]) {
  const issues: SalaryValidationIssue[] = [];

  for (const record of records) {
    if (record.actualAmount === 0 && record.totalPayable === 0) {
      continue;
    }

    const expectedDeduction = (
      record.deductSocialSecurity +
      record.deductLoan +
      record.deductUrgent +
      record.deductOther +
      record.deductUtilities
    );
    if (!amountsClose(record.totalDeduction, expectedDeduction)) {
      issues.push({
        name: record.name,
        field: '应扣款合计',
        message: `应扣款合计 ${formatNumber(record.totalDeduction)} 与各扣款项合计 ${formatNumber(expectedDeduction)} 不一致`,
      });
    }

    const expectedActual = record.totalPayable - record.totalDeduction;
    if (!amountsClose(record.actualAmount, expectedActual)) {
      issues.push({
        name: record.name,
        field: '实发金额',
        message: `实发金额 ${formatNumber(record.actualAmount)} 与 应付工资合计-应扣款合计 ${formatNumber(expectedActual)} 不一致`,
      });
    }
  }

  return issues;
}

function amountsClose(left: number, right: number) {
  return Math.abs(left - right) <= 0.05;
}

function formatNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}

function parseOfficeSalaryRows(data: CellValue[][]): OfficeSalaryRecord[] {
  const records: OfficeSalaryRecord[] = [];
  const lookup = createSalaryColumnLookup(data);
  const rows = data.slice(lookup.firstDataRowIndex >= 0 ? lookup.firstDataRowIndex : 0);

  for (const row of rows) {
    const name = textByColumn(row, lookup, ['姓名'], 1);
    if (!name || name === '姓名' || name === '合计') {
      continue;
    }

    if (!isLikelySalaryDataRow(row)) {
      continue;
    }

    records.push({
      name,
      department: textByColumn(row, lookup, ['部门'], 4),
      baseSalary: numberByColumn(row, lookup, ['基本工资'], 5),
      shouldAttendDays: numberByColumn(row, lookup, ['正班应出勤天数', '应出勤天数'], 6, 22),
      saturdayDays: numberByColumn(row, lookup, ['当月周六天数', '周六天数'], 7, 4),
      normalAttendanceDays: numberByColumn(row, lookup, ['正班实际出勤天数', '实际出勤天数'], 8),
      paidLeaveDays: numberByColumn(row, lookup, ['本月已休带薪假', '带薪假'], 9),
      weekdayOvertime: numberByColumn(row, lookup, ['平时加班时间', '平时加班'], 10),
      weekendOvertime: numberByColumn(row, lookup, ['周未加班时间', '周末加班时间', '周末加班'], 11),
      holidayOvertime: numberByColumn(row, lookup, ['法定日加班', '法定节假加班'], 12),
      normalPay: numberByColumn(row, lookup, ['实际出勤工资'], 13),
      holidayVacationPay: numberByColumn(row, lookup, ['本月法定日休假工资', '法定日休假工资'], 14),
      weekdayOvertimePay: numberByColumn(row, lookup, ['平时加班工资'], 15),
      weekendOvertimePay: numberByColumn(row, lookup, ['周未加班工资', '周末加班工资'], 16),
      holidayOvertimePay: numberByColumn(row, lookup, ['法定日加班工资', '法定节假加班工资'], 17),
      performanceBonus: numberByColumn(row, lookup, ['绩效奖金', '绩效奖金浮动'], 18),
      mealSubsidy: numberByColumn(row, lookup, ['用餐补贴'], 19),
      housingSubsidy: numberByColumn(row, lookup, ['住房补贴'], 20),
      transportSubsidy: numberByColumn(row, lookup, ['交通补贴'], 21),
      subsidy: numberByColumn(row, lookup, ['补贴'], 22),
      fine: numberByColumn(row, lookup, ['扣款', '扣款如有填负数'], 23),
      otherDeduct: numberByColumn(row, lookup, ['其他扣款', '其他扣款如有填负数'], 24),
      utilities: numberByColumn(row, lookup, ['水电费'], 25),
      totalPayable: numberByColumn(row, lookup, ['应领工资'], 26),
      housingFund: numberByColumn(row, lookup, ['公积金'], 27),
      socialInsurance: numberByColumn(row, lookup, ['社会保险'], 28),
      socialSecurityAdjust: numberByColumn(row, lookup, ['社保养老调'], 29),
      socialSecuritySubsidy: numberByColumn(row, lookup, ['社保补贴'], 30),
      preTaxSalary: numberByColumn(row, lookup, ['税前工资'], 31),
      incomeTax: numberByColumn(row, lookup, ['个人所得税'], 32),
      actualAmount: numberByColumn(row, lookup, ['实发工资'], 33),
      bankAccount: cleanBankAccount(columnValue(row, lookup, ['银行卡号'], 35)),
      remark: textByColumn(row, lookup, ['备注'], 36),
    });
  }

  return records;
}

function parseWorkshopSalaryRows(data: CellValue[][]): WorkshopSalaryRecord[] {
  const records: WorkshopSalaryRecord[] = [];
  const lookup = createSalaryColumnLookup(data);
  const rows = data.slice(lookup.firstDataRowIndex >= 0 ? lookup.firstDataRowIndex : 0);

  for (const row of rows) {
    const name = textByColumn(row, lookup, ['姓名'], 1);
    if (!name || name === '姓名') {
      continue;
    }

    if (!isLikelySalaryDataRow(row)) {
      continue;
    }

    records.push({
      name,
      isFullAttendance: textByColumn(row, lookup, ['是否全勤'], 2) === '是' ? '是' : '否',
      idCard: textByColumn(row, lookup, ['身份证号', '身份证']),
      bankAccount: cleanBankAccount(columnValue(row, lookup, ['银行卡号'])),
      bankName: textByColumn(row, lookup, ['开户行', '银行名称', '银行']),
      baseSalary: numberByColumn(row, lookup, ['底薪', '基本工资'], 3),
      performanceAllowance: numberByColumn(row, lookup, ['绩效津贴'], 4),
      otherSubsidy: numberByColumn(row, lookup, ['其他补贴'], 5),
      requiredHours: numberByColumn(row, lookup, ['应出勤小时'], 6, 176),
      normalFullAttendance: numberByColumn(row, lookup, ['正班满勤小时'], 7, 176),
      normalHours: numberByColumn(row, lookup, ['正班小时'], 8),
      weekdayOvertime: numberByColumn(row, lookup, ['平时加班小时'], 9),
      weekendOvertime: numberByColumn(row, lookup, ['周末加班小时'], 10),
      holidayOvertime: numberByColumn(row, lookup, ['法定节假加班小时', '法定日加班小时'], 11),
      nightShift: numberByColumn(row, lookup, ['夜班天', '夜班'], 12),
      absentDays: numberByColumn(row, lookup, ['旷工'], 13),
      personalLeave: numberByColumn(row, lookup, ['事假'], 14),
      sickLeave: numberByColumn(row, lookup, ['病假'], 15),
      lateEarlyMinutes: numberByColumn(row, lookup, ['迟到早退分'], 16),
      lateEarlyCount: numberByColumn(row, lookup, ['迟到早退次'], 17),
      signCardCount: numberByColumn(row, lookup, ['签卡次数'], 18),
      evalCoeff: numberByColumn(row, lookup, ['考核评价系数'], 19, 1),
      normalPay: numberByColumn(row, lookup, ['实际正班出勤工资'], 20),
      performancePay: numberByColumn(row, lookup, ['绩效津贴工资'], 21),
      weekdayOvertimePay: numberByColumn(row, lookup, ['平时加班工资'], 22),
      weekendOvertimePay: numberByColumn(row, lookup, ['周末加班工资'], 23),
      holidayOvertimePay: numberByColumn(row, lookup, ['法定节假加班工资', '法定日加班工资'], 24),
      sickPay: numberByColumn(row, lookup, ['病假工资'], 25),
      livingSubsidy: numberByColumn(row, lookup, ['生活补贴'], 26),
      otherPay: numberByColumn(row, lookup, ['其他补贴'], 27, 0, 1),
      seniorityAward: numberByColumn(row, lookup, ['工龄奖'], 28),
      fullAttendanceAward: numberByColumn(row, lookup, ['全勤奖'], 29),
      positionSubsidy: numberByColumn(row, lookup, ['岗位补贴'], 30),
      workReward: numberByColumn(row, lookup, ['工作奖励'], 31),
      springFestivalSubsidy: numberByColumn(row, lookup, ['春节按时返岗补贴'], 32),
      socialSecuritySubsidy: numberByColumn(row, lookup, ['社保补贴'], 33),
      totalPayable: numberByColumn(row, lookup, ['应付工资合计'], 34),
      deductSocialSecurity: numberByColumn(row, lookup, ['扣社保'], 35),
      deductLoan: numberByColumn(row, lookup, ['借款'], 36),
      deductUrgent: numberByColumn(row, lookup, ['急辞扣款'], 37),
      deductOther: numberByColumn(row, lookup, ['其他'], 38),
      deductUtilities: numberByColumn(row, lookup, ['本月水电费', '水电费'], 39),
      totalDeduction: numberByColumn(row, lookup, ['应扣款合计'], 40),
      actualAmount: numberByColumn(row, lookup, ['实发金额', '实发工资'], 41),
    });
  }

  return records;
}

function importOfficeSalaryRecords(records: OfficeSalaryRecord[], year: number, month: number, locationKey: LocationKey) {
  const importLocation = displayLocation(locationKey);
  const result = createImportResult<OfficeSalaryRecord>();

  for (const record of records) {
    const employee = getEligibleEmployee(record.name, locationKey);
    if (!employee) {
      collectSkippedEmployee(result, record.name, importLocation);
      continue;
    }

    const normalHours = record.normalAttendanceDays * 8;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const fields: Record<string, SqlValue> = {
      employee_id: employee.id,
      month: monthStr,
      total_days: record.normalAttendanceDays,
      work_hours: normalHours + record.weekdayOvertime,
      overtime_hours: record.weekdayOvertime,
      weekend_overtime: record.weekendOvertime,
      details: JSON.stringify({ remark: record.remark }),
      employee_name: record.name,
      year,
      month_num: month,
      normal_hours: normalHours,
      weekday_overtime: record.weekdayOvertime,
      base_salary: record.baseSalary,
      normal_pay: record.normalPay,
      weekday_overtime_pay: record.weekdayOvertimePay,
      weekend_overtime_pay: record.weekendOvertimePay,
      total_payable: record.totalPayable,
      deduction: record.socialInsurance + record.housingFund,
      actual_amount: record.actualAmount,
      location: importLocation,
      performance_allowance: record.performanceBonus,
      living_subsidy: record.mealSubsidy,
      other_pay: record.housingSubsidy + record.transportSubsidy,
      deduct_utilities: record.utilities,
      total_deduction: record.socialInsurance + record.housingFund,
      bank_account: record.bankAccount,
      performance_pay: record.performanceBonus,
      holiday_overtime_pay: record.holidayOvertimePay,
      department: record.department,
      should_attend_days: record.shouldAttendDays,
      saturday_days: record.saturdayDays,
      actual_attend_days: record.normalAttendanceDays,
      paid_leave_days: record.paidLeaveDays,
      holiday_overtime: record.holidayOvertime,
      holiday_pay: record.holidayVacationPay,
      performance_bonus: record.performanceBonus,
      meal_subsidy: record.mealSubsidy,
      housing_subsidy: record.housingSubsidy,
      transport_subsidy: record.transportSubsidy,
      other_subsidy: record.subsidy,
      fine: record.fine,
      other_deduction: record.otherDeduct,
      housing_fund: record.housingFund,
      social_insurance: record.socialInsurance,
      social_pension_adj: record.socialSecurityAdjust,
      social_security_subsidy: record.socialSecuritySubsidy,
      pre_tax_salary: record.preTaxSalary,
      income_tax: record.incomeTax,
      remark: record.remark,
    };

    const upsertResult = upsertMonthlyRecord(employee.id, year, month, fields);
    result.insertedCount += upsertResult.inserted ? 1 : 0;
    result.updatedCount += upsertResult.inserted ? 0 : 1;
    result.records.push(record);
  }

  return result;
}

function importWorkshopSalaryRecords(records: WorkshopSalaryRecord[], year: number, month: number, locationKey: LocationKey) {
  const importLocation = displayLocation(locationKey);
  const result = createImportResult<WorkshopSalaryRecord>();

  for (const record of records) {
    const employee = getEligibleEmployee(record.name, locationKey);
    if (!employee) {
      collectSkippedEmployee(result, record.name, importLocation);
      continue;
    }

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const fields: Record<string, SqlValue> = {
      employee_id: employee.id,
      month: monthStr,
      total_days: Math.ceil(record.normalHours / 8),
      work_hours: record.normalHours + record.weekdayOvertime,
      overtime_hours: record.weekdayOvertime,
      weekend_overtime: record.weekendOvertime,
      details: '{}',
      employee_name: record.name,
      year,
      month_num: month,
      normal_hours: record.normalHours,
      weekday_overtime: record.weekdayOvertime,
      base_salary: record.baseSalary,
      normal_pay: record.normalPay,
      weekday_overtime_pay: record.weekdayOvertimePay,
      weekend_overtime_pay: record.weekendOvertimePay,
      total_payable: record.totalPayable,
      deduction: record.totalDeduction,
      actual_amount: record.actualAmount,
      location: importLocation,
      is_full_attendance: record.isFullAttendance,
      id_card: record.idCard,
      bank_account: record.bankAccount,
      bank_name: record.bankName,
      performance_allowance: record.performanceAllowance,
      other_subsidy_base: record.otherSubsidy,
      required_hours: record.requiredHours,
      full_attendance_hours: record.normalFullAttendance,
      holiday_overtime_hours: record.holidayOvertime,
      night_shift_days: record.nightShift,
      absent_days: record.absentDays,
      personal_leave_hours: record.personalLeave,
      sick_leave_hours: record.sickLeave,
      late_early_minutes: record.lateEarlyMinutes,
      late_early_count: record.lateEarlyCount,
      sign_card_count: record.signCardCount,
      evaluation_coefficient: record.evalCoeff,
      performance_pay: record.performancePay,
      holiday_overtime_pay: record.holidayOvertimePay,
      sick_pay: record.sickPay,
      living_subsidy: record.livingSubsidy,
      other_pay: record.otherPay,
      seniority_award: record.seniorityAward,
      full_attendance_award: record.fullAttendanceAward,
      position_subsidy: record.positionSubsidy,
      work_reward: record.workReward,
      spring_festival_subsidy: record.springFestivalSubsidy,
      social_security_subsidy: record.socialSecuritySubsidy,
      deduct_social_security: record.deductSocialSecurity,
      deduct_loan: record.deductLoan,
      deduct_urgent: record.deductUrgent,
      deduct_other: record.deductOther,
      deduct_utilities: record.deductUtilities,
      total_deduction: record.totalDeduction,
    };

    const upsertResult = upsertMonthlyRecord(employee.id, year, month, fields);
    result.insertedCount += upsertResult.inserted ? 1 : 0;
    result.updatedCount += upsertResult.inserted ? 0 : 1;
    result.records.push(record);
  }

  return result;
}

function upsertMonthlyRecord(employeeId: number, year: number, month: number, fields: Record<string, SqlValue>) {
  const existing = db.prepare(`
    SELECT id FROM work_hours_monthly
    WHERE employee_id = ? AND year = ? AND month_num = ?
    LIMIT 1
  `).get(employeeId, year, month) as MonthlyRecordRow | undefined;

  if (existing) {
    const updateEntries = Object.entries(fields).filter(([key]) => (
      key !== 'employee_id' &&
      key !== 'details' &&
      key !== 'total_days'
    ));
    const setClause = updateEntries.map(([key]) => `${key} = ?`).join(', ');
    db.prepare(`UPDATE work_hours_monthly SET ${setClause} WHERE id = ?`)
      .run(...updateEntries.map(([, value]) => value), existing.id);
    return { inserted: false };
  }

  const insertEntries = Object.entries(fields);
  const columns = insertEntries.map(([key]) => key).join(', ');
  const placeholders = insertEntries.map(() => '?').join(', ');
  db.prepare(`INSERT INTO work_hours_monthly (${columns}) VALUES (${placeholders})`)
    .run(...insertEntries.map(([, value]) => value));

  return { inserted: true };
}

function getEligibleEmployee(name: string, locationKey: LocationKey) {
  const aliases = locationAliases(locationKey);
  return db.prepare(`
    SELECT * FROM employees
    WHERE name = ? AND status = '在职' AND location IN (?, ?)
    LIMIT 1
  `).get(name, aliases[0], aliases[1]) as EmployeeRow | undefined;
}

function collectSkippedEmployee<TRecord extends ParsedSalaryRecord>(
  result: ReturnType<typeof createImportResult<TRecord>>,
  name: string,
  importLocation: string,
) {
  const existingEmployee = db.prepare('SELECT * FROM employees WHERE name = ? LIMIT 1')
    .get(name) as EmployeeRow | undefined;

  result.skippedEmployees.push(name);

  if (existingEmployee) {
    result.skipped.push({
      name,
      reason: `员工不是${importLocation}在职员工`,
      status: existingEmployee.status ?? undefined,
      location: existingEmployee.location ?? undefined,
    });
    return;
  }

  result.skipped.push({
    name,
    reason: '员工管理中不存在该员工',
  });
}

function createImportResult<TRecord extends ParsedSalaryRecord>() {
  return {
    records: [] as TRecord[],
    insertedCount: 0,
    updatedCount: 0,
    skippedEmployees: [] as string[],
    skipped: [] as SkippedEmployee[],
  };
}

function isLikelySalaryDataRow(row: CellValue[] = []) {
  const serial = cellText(row[0]);
  return /^\d+$/.test(serial);
}

function parseNumber(value: CellValue, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = cellText(value)
    .replace(/,/g, '')
    .replace(/[¥￥]/g, '')
    .replace(/\s+/g, '');

  if (!text || text === '-' || text === '--' || text === '/') {
    return fallback;
  }

  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return fallback;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cellText(value: CellValue) {
  return String(value ?? '').trim();
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, '').replace(/：/g, ':');
}

function normalizeHeaderText(value: string) {
  return normalizeText(value)
    .replace(/[()（）:;；,，、|\[\]【】{}]/g, '')
    .replace(/[A-Za-z]/g, '');
}

function toValidYear(value: unknown) {
  const year = parseInt(String(value ?? ''), 10);
  return year >= 2000 && year <= 2100 ? year : null;
}

function toValidMonth(value: unknown) {
  const month = parseInt(String(value ?? ''), 10);
  return month >= 1 && month <= 12 ? month : null;
}

function displayLocation(locationKey: LocationKey) {
  return locationKey === 'office' ? '办公室' : '车间';
}

function locationAliases(locationKey: LocationKey): [string, string] {
  return locationKey === 'office' ? ['office', '办公室'] : ['workshop', '车间'];
}
