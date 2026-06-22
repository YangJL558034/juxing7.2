import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseLaborContractTerminationRow, type LaborContractTerminationDbRow } from '@/lib/labor-contract-termination-records';

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

function underlineField(value: unknown, className = '', blankSpaces = 10) {
  const text = String(value ?? '').trim();
  const content = text ? escapeHtml(text) : '&nbsp;'.repeat(blankSpaces);
  return `<span class="line-field ${className}">${content}</span>`;
}

function formatChineseDate(value?: string | null) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return '______年____月____日';
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

function buildPrintHtml(record: ReturnType<typeof parseLaborContractTerminationRow>) {
  const data = record.data;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(record.employeeName)}-解除劳动合同通知书</title>
  <style>
    @page { size: A4; margin: 15mm 31.8mm 25mm 31.8mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #d1d5db;
      color: #000;
      font-family: SimSun, "宋体", "Microsoft YaHei", Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.55;
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
      padding: 15mm 31.8mm 25mm;
      background: #fff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
    }
    h1 {
      margin: 0 0 10mm;
      text-align: center;
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: 1px;
      line-height: 1.2;
    }
    p { margin: 0 0 4.2mm; }
    .company { margin-top: 6mm; text-align: right; }
    .date { text-align: right; }
    .serial { margin-top: 2.5mm; text-align: left; font-size: 10pt; }
    .confirm-title { margin-top: 6mm; font-weight: 700; }
    .signature {
      display: flex;
      align-items: flex-end;
      gap: 12mm;
      margin-top: 7mm;
      white-space: nowrap;
    }
    .signature-date {
      margin-left: auto;
      white-space: nowrap;
    }
    .line-field {
      display: inline-block;
      min-width: 22mm;
      padding: 0 1.5mm 0.2mm;
      border-bottom: 1px solid #000;
      line-height: 1.2;
      text-align: center;
      vertical-align: baseline;
      white-space: nowrap;
    }
    .name-field {
      min-width: 24mm;
      text-align: left;
    }
    .date-field {
      min-width: 42mm;
    }
    .reason-field {
      display: inline;
      padding: 0 1mm 0.2mm;
      text-align: left;
      white-space: normal;
    }
    .signature-name-field {
      min-width: 32mm;
      text-align: left;
    }
    .signature-date-field {
      min-width: 10mm;
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
    <h1>解除劳动合同通知书</h1>
    <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${underlineField(data.employeeName || record.employeeName, 'name-field')}${escapeHtml(data.honorific || record.honorific)}：</p>
    <p>根据公司与您签订的《劳动合同》，公司自${underlineField(formatChineseDate(data.terminationDate || record.terminationDate), 'date-field')}起将与您解除劳动聘用关系，终止与您的劳动合同。</p>
    <p>解除（终止）合同的原因如下：${underlineField(data.reason || record.reason, 'reason-field', 18)}</p>
    <p>请接到本通知后，在${underlineField(formatChineseDate(data.procedureDeadline || record.procedureDeadline), 'date-field')}前到所属人力资源部门办理相关离职手续。</p>
    <p>同时，也非常感谢您一直以来辛勤的工作。希望您在新的工作岗位上取得更大的成绩！</p>
    <p>本通知书一式两份，人力资源部门和终止劳动合同的员工各执一份。</p>
    <p class="company">${escapeHtml(data.companyName || record.companyName)}&nbsp;&nbsp;&nbsp;&nbsp;</p>
    <p class="date">人力资源部</p>
    <p class="date">${escapeHtml(formatChineseDate(data.noticeDate || record.noticeDate))}</p>
    <p class="serial">-1015365390525</p>
    <p class="confirm-title">员工确认书：</p>
    <p>本人已知晓《解除劳动合同通知书》，并将在规定的时间内办理离职手续。</p>
    <p class="signature"><span>员工签名：${underlineField('', 'signature-name-field', 16)}</span><span class="signature-date">${underlineField('', 'signature-date-field', 6)}年${underlineField('', 'signature-date-field', 3)}月${underlineField('', 'signature-date-field', 3)}日</span></p>
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

    const row = db.prepare('SELECT * FROM labor_contract_termination_records WHERE id = ? AND deleted_at IS NULL').get(id) as LaborContractTerminationDbRow | undefined;
    if (!row) return NextResponse.json({ success: false, error: '记录不存在或已删除' }, { status: 404 });

    const record = parseLaborContractTerminationRow(row);
    db.prepare("UPDATE labor_contract_termination_records SET printed_at = datetime('now', '+8 hours'), updated_at = datetime('now', '+8 hours') WHERE id = ?").run(id);

    return new NextResponse(buildPrintHtml(record), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Print labor contract termination record error:', error);
    return NextResponse.json({ success: false, error: '打印解除劳动合同通知书失败' }, { status: 500 });
  }
}
