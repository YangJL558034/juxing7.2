export const CHINA_TIME_ZONE = 'Asia/Shanghai';

type DateInput = string | number | Date | null | undefined;

function parseChinaDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00+08:00`);
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?/.test(text)) {
    const normalized = text.replace(' ', 'T');
    return new Date(`${normalized.length === 16 ? `${normalized}:00` : normalized}+08:00`);
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function partsFor(date: Date) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: CHINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(parts.map(part => [part.type, part.value])) as Record<string, string>;
}

export function chinaNowSql() {
  const part = partsFor(new Date());
  return `${part.year}-${part.month}-${part.day} ${part.hour}:${part.minute}:${part.second}`;
}

export function chinaToday() {
  const part = partsFor(new Date());
  return `${part.year}-${part.month}-${part.day}`;
}

export function chinaCurrentMonth() {
  const part = partsFor(new Date());
  return `${part.year}-${part.month}`;
}

export function formatChinaDate(value: DateInput) {
  const date = parseChinaDate(value);
  if (!date) return '-';
  const part = partsFor(date);
  return `${part.year}-${part.month}-${part.day}`;
}

export function formatChinaDateTime(value: DateInput, withSeconds = true) {
  const date = parseChinaDate(value);
  if (!date) return '-';
  const part = partsFor(date);
  const time = withSeconds
    ? `${part.hour}:${part.minute}:${part.second}`
    : `${part.hour}:${part.minute}`;
  return `${part.year}-${part.month}-${part.day} ${time}`;
}

export function formatChinaTime(value: DateInput) {
  const date = parseChinaDate(value);
  if (!date) return '-';
  const part = partsFor(date);
  return `${part.hour}:${part.minute}`;
}

export function parseChinaTime(value: DateInput) {
  return parseChinaDate(value);
}
