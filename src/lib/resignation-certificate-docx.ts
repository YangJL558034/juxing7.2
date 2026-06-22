import fs from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import type { ResignationCertificateRecord } from '@/types/resignation-certificate';

export type ResignationCertificateDocumentType = 'certificate' | 'receipt';

const PERSONAL_TEMPLATE_PATH = path.join(process.cwd(), 'src', 'templates', 'resignation-certificate-personal-template.docx');
const COMPANY_TEMPLATE_PATH = path.join(process.cwd(), 'src', 'templates', 'resignation-certificate-company-template.docx');
const RECEIPT_TEMPLATE_PATH = path.join(process.cwd(), 'src', 'templates', 'resignation-certificate-receipt-template.docx');

interface ZipEntry {
  path: string;
  content: Buffer;
}

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files: Array<{ path: string; content: Buffer | string }>): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const file of files) {
    const name = Buffer.from(file.path, 'utf8');
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
    offset += local.length + name.length + content.length;
  }

  const centralOffset = offset;
  const centralContent = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralContent.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...chunks, centralContent, end]);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) return index;
  }
  throw new Error('Invalid DOCX template: EOCD not found');
}

function readZip(buffer: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  let pointer = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error('Invalid DOCX template');
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const fileNameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const fileName = buffer.subarray(pointer + 46, pointer + 46 + fileNameLength).toString('utf8');
    const localFileNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    if (method !== 0 && method !== 8) throw new Error(`Unsupported DOCX compression method: ${method}`);
    entries.push({ path: fileName, content: method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed) });
    pointer += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readEntry(entries: ZipEntry[], filePath: string): string {
  const entry = entries.find((item) => item.path === filePath);
  if (!entry) throw new Error(`DOCX template is missing ${filePath}`);
  return entry.content.toString('utf8');
}

function writeEntry(entries: ZipEntry[], filePath: string, content: Buffer | string) {
  const entry = entries.find((item) => item.path === filePath);
  if (entry) entry.content = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
}

function formatChineseDate(value?: string | null): string {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return '____年__月__日';
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

function formatReceiptDate(value?: string | null): string {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return '年   月   日';
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

function dateParts(value?: string | null) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return { year: '    ', month: '    ', day: '    ' };
  return { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) };
}

function paragraphText(originalParagraph: string, value: string): string {
  const start = originalParagraph.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>';
  const pPr = originalParagraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || '';
  const rPr = originalParagraph.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] || '<w:rPr><w:rFonts w:hint="eastAsia"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
  return `${start}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`;
}

function fillCertificateTemplate(documentXml: string, record: ResignationCertificateRecord): string {
  const data = record.data;
  let index = -1;
  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    index += 1;
    if (data.certificateType === 'company') {
      if (index === 1) {
        return paragraphText(
          paragraph,
          `${data.employeeName}${data.honorific}，自${formatChineseDate(data.hireDate)}至${formatChineseDate(data.leaveDate)}在我司担任${data.department}（部门）的${data.position}职务，因我司提出解除劳动关系，现双方协商一致，确认该职员与我司解除劳动合同，双方劳动关系正式解除。现已完成离职手续办理！`,
        );
      }
      if (index === 5) return paragraphText(paragraph, `     ${formatChineseDate(data.issueDate)}`);
      return paragraph;
    }

    if (index === 1) {
      return paragraphText(
        paragraph,
        `${data.employeeName}${data.honorific}，自${formatChineseDate(data.hireDate)}至${formatChineseDate(data.leaveDate)}在我司担任${data.department}（部门）的${data.position}职务，由于个人原因该职员提出辞职，我司同意其辞职申请，与其解除劳动关系。现已完成离职手续办理！特此证明！`,
      );
    }
    if (index === 4) return paragraphText(paragraph, `  ${formatChineseDate(data.issueDate)}`);
    return paragraph;
  });
}

function fillReceiptTemplate(documentXml: string, record: ResignationCertificateRecord): string {
  const data = record.data;
  const issue = dateParts(data.issueDate);
  const leave = dateParts(data.leaveDate);
  let index = -1;
  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    index += 1;
    if (index === 2) {
      return paragraphText(paragraph, `员工 ${data.employeeName} 确认已收到 ${data.companyName} 公司于${issue.year}年`);
    }
    if (index === 3) {
      return paragraphText(paragraph, `${issue.month}月${issue.day}日出具的《离职证明》，并对此予以确认并认可，自${leave.year}年`);
    }
    if (index === 4) return paragraphText(paragraph, `${leave.month}月${leave.day}日起双方正式解除劳动关系！`);
    if (index === 7 && data.receiptDate) return paragraphText(paragraph, formatReceiptDate(data.receiptDate));
    return paragraph;
  });
}

export function buildResignationCertificateDocx(
  record: ResignationCertificateRecord,
  documentType: ResignationCertificateDocumentType,
): Buffer {
  const templatePath = documentType === 'receipt'
    ? RECEIPT_TEMPLATE_PATH
    : record.certificateType === 'company'
      ? COMPANY_TEMPLATE_PATH
      : PERSONAL_TEMPLATE_PATH;
  const template = fs.readFileSync(templatePath);
  const entries = readZip(template);
  const documentXml = readEntry(entries, 'word/document.xml');
  const filledXml = documentType === 'receipt'
    ? fillReceiptTemplate(documentXml, record)
    : fillCertificateTemplate(documentXml, record);
  writeEntry(entries, 'word/document.xml', filledXml);
  return createZip(entries.map((entry) => ({ path: entry.path, content: entry.content })));
}
