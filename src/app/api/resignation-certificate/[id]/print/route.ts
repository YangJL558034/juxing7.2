import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseResignationCertificateRow, type ResignationCertificateDbRow } from '@/lib/resignation-certificate-records';
import type { ResignationCertificateDocumentType } from '@/lib/resignation-certificate-docx';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatChineseDate(value?: string | null) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return '____年__月__日';
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

function dateParts(value?: string | null) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return { year: '    ', month: '    ', day: '    ' };
  return { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) };
}

function documentTypeFromRequest(request: NextRequest): ResignationCertificateDocumentType {
  return new URL(request.url).searchParams.get('type') === 'receipt' ? 'receipt' : 'certificate';
}

function buildCertificateContent(record: ReturnType<typeof parseResignationCertificateRow>) {
  const data = record.data;
  if (record.certificateType === 'company') {
    return `
      <p class="content">${escapeHtml(data.employeeName)}${escapeHtml(data.honorific)}，自${escapeHtml(formatChineseDate(data.hireDate))}至${escapeHtml(formatChineseDate(data.leaveDate))}在我司担任${escapeHtml(data.department)}（部门）的${escapeHtml(data.position)}职务，因我司提出解除劳动关系，现双方协商一致，确认该职员与我司解除劳动合同，双方劳动关系正式解除。现已完成离职手续办理！</p>
      <p class="content">特此证明！</p>
    `;
  }

  return `
    <p class="content">${escapeHtml(data.employeeName)}${escapeHtml(data.honorific)}，自${escapeHtml(formatChineseDate(data.hireDate))}至${escapeHtml(formatChineseDate(data.leaveDate))}在我司担任${escapeHtml(data.department)}（部门）的${escapeHtml(data.position)}职务，由于个人原因该职员提出辞职，我司同意其辞职申请，与其解除劳动关系。现已完成离职手续办理！特此证明！</p>
  `;
}

function buildPrintHtml(record: ReturnType<typeof parseResignationCertificateRow>, documentType: ResignationCertificateDocumentType) {
  const data = record.data;
  const isReceipt = documentType === 'receipt';
  const issue = dateParts(data.issueDate);
  const leave = dateParts(data.leaveDate);
  const title = isReceipt ? '签收回执' : '离职证明';
  const body = isReceipt
    ? `
      <p class="receipt">员工 ${escapeHtml(data.employeeName)} 确认已收到 ${escapeHtml(data.companyName)} 公司于${escapeHtml(issue.year)}年</p>
      <p class="receipt">${escapeHtml(issue.month)}月${escapeHtml(issue.day)}日出具的《离职证明》，并对此予以确认并认可，自${escapeHtml(leave.year)}年</p>
      <p class="receipt">${escapeHtml(leave.month)}月${escapeHtml(leave.day)}日起双方正式解除劳动关系！</p>
      <p class="receipt-sign">员工（签名捺印）：</p>
      <p class="receipt-date">${data.receiptDate ? escapeHtml(formatChineseDate(data.receiptDate)) : '年   月   日'}</p>
    `
    : `
      ${buildCertificateContent(record)}
      <p class="seal">公司（公章）</p>
      <p class="seal-date">${escapeHtml(formatChineseDate(data.issueDate))}</p>
    `;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(record.employeeName)}-${title}</title>
  <style>
    @page { size: A4; margin: 28mm 30mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #d1d5db;
      color: #000;
      font-family: SimSun, "宋体", "Microsoft YaHei", Arial, sans-serif;
      font-size: 14pt;
      line-height: 1.9;
    }
    .toolbar {
      position: sticky;
      top: 0;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 16px;
      background: #fff;
      border-bottom: 1px solid #d1d5db;
    }
    .toolbar button {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      padding: 7px 14px;
      cursor: pointer;
      font-size: 13px;
    }
    .toolbar .primary {
      border-color: #111827;
      background: #111827;
      color: #fff;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 12px auto;
      padding: 28mm 30mm;
      background: #fff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
    }
    h1 {
      margin: 0 0 26mm;
      text-align: center;
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: 2px;
      line-height: 1.2;
    }
    .content {
      margin: 0 0 8mm;
      text-indent: 2em;
      text-align: justify;
    }
    .seal {
      margin: 36mm 0 0;
      text-align: right;
    }
    .seal-date {
      margin: 3mm 0 0;
      text-align: right;
    }
    .receipt {
      margin: 0 0 3mm;
      text-indent: 2em;
      text-align: justify;
    }
    .receipt-sign {
      margin: 18mm 0 0 90mm;
    }
    .receipt-date {
      margin: 8mm 0 0 118mm;
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .page {
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.close()">关闭</button>
    <button type="button" class="primary" onclick="window.print()">打印</button>
  </div>
  <main class="page">
    <h1>${title}</h1>
    ${body}
  </main>
  <script>
    window.addEventListener('load', function () {
      window.setTimeout(function () { window.print(); }, 300);
    });
  </script>
</body>
</html>`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });

    const row = db.prepare('SELECT * FROM resignation_certificate_records WHERE id = ? AND deleted_at IS NULL').get(id) as ResignationCertificateDbRow | undefined;
    if (!row) return NextResponse.json({ success: false, error: '离职证明不存在或已删除' }, { status: 404 });

    const record = parseResignationCertificateRow(row);
    const documentType = documentTypeFromRequest(request);
    const timestampColumn = documentType === 'receipt' ? 'receipt_printed_at' : 'certificate_printed_at';
    db.prepare(`UPDATE resignation_certificate_records SET ${timestampColumn} = datetime('now', '+8 hours'), updated_at = datetime('now', '+8 hours') WHERE id = ?`).run(id);

    return new NextResponse(buildPrintHtml(record, documentType), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Print resignation certificate record error:', error);
    return NextResponse.json({ success: false, error: '打印离职证明失败' }, { status: 500 });
  }
}
