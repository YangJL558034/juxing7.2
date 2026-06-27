import * as XLSX from 'xlsx-js-style';
import {
  createDefaultSocialSecurityPurchaseData,
  normalizeSocialSecurityPurchaseCategory,
  normalizeSocialSecurityPurchaseData,
  socialSecurityPurchaseCategoryLabel,
  socialSecurityPurchaseHeaders,
} from '@/lib/social-security-purchase-records';
import type {
  SocialSecurityPurchaseCategory,
  SocialSecurityPurchaseFormData,
  SocialSecurityPurchaseRecord,
} from '@/types/social-security-purchase';

type CellValue = string | number | boolean | Date | null | undefined;

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function compactHeader(value: unknown) {
  return clean(value).replace(/\s+/g, '').replace(/[()（）]/g, '').toLowerCase();
}

function sheetRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) throw new Error('未找到可导入的工作表');
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd',
  }) as CellValue[][];
  return { sheetName, rows };
}

function findHeaderRow(rows: CellValue[][]) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const headers = rows[rowIndex].map(compactHeader);
    if (
      headers.includes(compactHeader('合同状态')) &&
      headers.includes(compactHeader('员工')) &&
      headers.includes(compactHeader('身份证号'))
    ) {
      return rowIndex;
    }
  }
  return -1;
}

function headerLookup(row: CellValue[]) {
  const lookup = new Map<string, number>();
  row.forEach((cell, index) => {
    const header = compactHeader(cell);
    if (header && !lookup.has(header)) lookup.set(header, index);
  });
  return lookup;
}

function valueByHeader(row: CellValue[], lookup: Map<string, number>, header: string) {
  const index = lookup.get(compactHeader(header));
  if (index === undefined) return '';
  return clean(row[index]);
}

export function parseSocialSecurityPurchaseWorkbook(buffer: Buffer, categoryInput: unknown) {
  const category = normalizeSocialSecurityPurchaseCategory(categoryInput);
  const { sheetName, rows } = sheetRows(buffer);
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex < 0) {
    throw new Error('未找到模板表头，请确认包含“合同状态、员工、身份证号”等列');
  }

  const lookup = headerLookup(rows[headerRowIndex]);
  const missingHeaders = socialSecurityPurchaseHeaders
    .map(([, label]) => label)
    .filter((label) => !lookup.has(compactHeader(label)));

  if (missingHeaders.includes('员工') || missingHeaders.includes('身份证号')) {
    throw new Error(`模板关键表头缺失：${missingHeaders.join('、')}`);
  }

  const records: SocialSecurityPurchaseFormData[] = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row || row.every((cell) => !clean(cell))) continue;

    const data = createDefaultSocialSecurityPurchaseData(category);
    for (const [key, label] of socialSecurityPurchaseHeaders) {
      data[key] = valueByHeader(row, lookup, label);
    }
    data.category = category;
    data.department = data.department || socialSecurityPurchaseCategoryLabel(category);

    const normalized = normalizeSocialSecurityPurchaseData(data);
    if (!normalized.employeeName || !normalized.idCard) continue;
    records.push(normalized);
  }

  return {
    sheetName,
    headerRow: headerRowIndex + 1,
    category,
    records,
    missingHeaders,
  };
}

function recordsForCategory(records: SocialSecurityPurchaseRecord[], category: SocialSecurityPurchaseCategory) {
  return records.filter((record) => record.category === category);
}

function worksheetForCategory(records: SocialSecurityPurchaseRecord[], category: SocialSecurityPurchaseCategory) {
  const title = `员工劳动合同台账-${socialSecurityPurchaseCategoryLabel(category)}购买社保`;
  const rows: unknown[][] = [
    [],
    [],
    [null, null, null, null, title],
    [],
    [],
    [],
    [null, null, null, ...socialSecurityPurchaseHeaders.map(([, label]) => label)],
    ...records.map((record) => [
      null,
      null,
      null,
      ...socialSecurityPurchaseHeaders.map(([key]) => record[key] || ''),
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 3 },
    { wch: 3 },
    { wch: 3 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
    { wch: 14 },
    { wch: 24 },
    { wch: 8 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
  ];

  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:X8');
  for (let col = 3; col <= 23; col++) {
    const address = XLSX.utils.encode_cell({ r: 6, c: col });
    const cell = worksheet[address];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E3A8A' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'D9E2F3' } },
          bottom: { style: 'thin', color: { rgb: 'D9E2F3' } },
          left: { style: 'thin', color: { rgb: 'D9E2F3' } },
          right: { style: 'thin', color: { rgb: 'D9E2F3' } },
        },
      };
    }
  }
  for (let row = 7; row <= range.e.r; row++) {
    for (let col = 3; col <= 23; col++) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[address];
      if (cell) {
        cell.s = {
          alignment: { vertical: 'center' },
          border: {
            bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
          },
        };
      }
    }
  }
  const titleCell = worksheet.E3;
  if (titleCell) {
    titleCell.s = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } };
  }
  worksheet['!freeze'] = { xSplit: 0, ySplit: 7 };
  return worksheet;
}

export function buildSocialSecurityPurchaseWorkbook(
  records: SocialSecurityPurchaseRecord[],
  categories: SocialSecurityPurchaseCategory[],
) {
  const workbook = XLSX.utils.book_new();
  for (const category of categories) {
    const categoryRecords = recordsForCategory(records, category);
    const sheet = worksheetForCategory(categoryRecords, category);
    const name = category === 'management' ? '购买社保-管理部' : '购买社保-车间';
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    cellStyles: true,
  }) as Buffer;
}
