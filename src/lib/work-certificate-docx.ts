import fs from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import type { WorkCertificateRecord } from '@/types/work-certificate';

const TEMPLATE_PATH = path.join(process.cwd(), 'src', 'templates', 'work-certificate-template.docx');

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
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  if (entry) entry.content = buffer;
}

function formatChineseDate(value?: string | null): string {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return '20  年 月 日';
  return `${match[1]} 年 ${Number(match[2])} 月 ${Number(match[3])} 日`;
}

function paragraphText(originalParagraph: string, value: string): string {
  const start = originalParagraph.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>';
  const pPr = originalParagraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || '';
  const rPr = originalParagraph.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] || '<w:rPr><w:rFonts w:hint="eastAsia"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>';
  return `${start}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`;
}

function fillTemplate(documentXml: string, record: WorkCertificateRecord): string {
  const data = record.data;
  const proofText = `兹证明 ${data.name || record.name} ，性别：${data.gender || record.gender || '  '}，身份证号码：${data.idCard || record.idCard} 为我公司在职员工。自 ${formatChineseDate(data.hireDate || record.hireDate)}入职，现在我司 ${data.department || record.department} 部门 担任 ${data.position || record.position} 一职。`;
  const purposeText = `本证明仅用于我公司员工的工作证明，用作${data.purpose || record.purpose || '办理银行卡'}用途；不作为我公司对该员工任何形式的担保文件。`;
  const companyText = data.companyName || '东莞山泽新能源科技有限公司';
  const issueDateText = formatChineseDate(data.issueDate);

  let index = -1;
  return documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    index += 1;
    if (paragraph.includes('兹证明')) return paragraphText(paragraph, proofText);
    if (paragraph.includes('本证明仅用于')) return paragraphText(paragraph, purposeText);
    if (paragraph.includes('东莞山泽新能源科技有限公司') || index === 11) return paragraphText(paragraph, companyText);
    if (index === 13) return paragraphText(paragraph, issueDateText);
    return paragraph;
  });
}

export function buildWorkCertificateDocx(record: WorkCertificateRecord): Buffer {
  const template = fs.readFileSync(TEMPLATE_PATH);
  const entries = readZip(template);
  const documentXml = fillTemplate(readEntry(entries, 'word/document.xml'), record);
  writeEntry(entries, 'word/document.xml', documentXml);
  return createZip(entries.map((entry) => ({ path: entry.path, content: entry.content })));
}
