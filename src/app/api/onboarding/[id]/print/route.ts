import { NextRequest, NextResponse } from 'next/server';
import { db, logOperationServer } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { parseOnboardingRow, type OnboardingDbRow } from '@/lib/onboarding-records';
import type { OnboardingRecord } from '@/types/onboarding';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function escapeHtml(value?: string | number | null) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value?: string | null) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const localDate = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+\d{1,2}:\d{2}:\d{2})?$/);
  if (localDate) {
    return `${localDate[1]}-${localDate[2].padStart(2, '0')}-${localDate[3].padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(parsed);
    const getPart = (type: string) => parts.find((part) => part.type === type)?.value || '';
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  }

  return raw.slice(0, 10);
}

function formatChineseDate(value?: string | null) {
  const normalized = formatDate(value);
  if (!normalized) return '____年__月__日';
  const [year, month, day] = normalized.split('-');
  if (!year || !month || !day) return escapeHtml(normalized);
  return `${year}年${month.padStart(2, '0')}月${day.padStart(2, '0')}日`;
}

function field(value?: string | number | null) {
  const text = String(value ?? '').trim();
  return escapeHtml(text || ' ');
}

function money(value?: string | null) {
  const amount = String(value ?? '').trim();
  if (!amount) return '';
  return amount.includes('元') ? amount : `${amount} 元/月`;
}

function checkbox(checked: boolean) {
  return checked ? '☑' : '☐';
}

function optionLine(options: string[], selected: string) {
  return options.map((option) => `${checkbox(selected === option)} ${escapeHtml(option)}`).join('&nbsp;&nbsp;&nbsp;');
}

function recruitmentSourceText(record: OnboardingRecord) {
  const selected = new Set(record.data.recruitmentSource || []);
  const otherText = record.data.otherRecruitmentSource?.trim() || '';
  const hasOther = selected.has('其他') || Boolean(otherText);

  return [
    `${checkbox(selected.has('网络'))}网络`,
    `${checkbox(selected.has('人才市场'))}人才市场`,
    `${checkbox(selected.has('内部推荐'))}内部推荐`,
    `${checkbox(hasOther)}其他${otherText ? `：${escapeHtml(otherText)}` : '___________________'}`,
  ].join('&nbsp;&nbsp;&nbsp;');
}

function healthText(record: OnboardingRecord) {
  const data = record.data;
  const line = (label: string, value: string, note?: string) =>
    `${label}：${checkbox(value === '无')}无&nbsp;&nbsp;${checkbox(value === '有')}有${note ? `：${escapeHtml(note)}` : '：________________________'}`;

  return [
    `利手：${checkbox(data.dominantHand === '右')}右&nbsp;&nbsp;${checkbox(data.dominantHand === '左')}左`,
    line('是否有重大疾病或家族病史', data.majorDisease, data.majorDiseaseNote),
    line('是否曾被认定工伤或持有残疾人证明', data.disabilityProof, data.disabilityProofNote),
    line('是否从事过特别繁重体力劳动及有毒有害工种', data.heavyWork, data.heavyWorkNote),
    line('是否有职业病或慢性影响工作的疾病或怀孕', data.occupationalDisease, data.occupationalDiseaseNote),
  ].join('<br />');
}

function noticeText(record: OnboardingRecord) {
  const data = record.data;
  return [
    `1、本人入厂日期为：${formatChineseDate(data.hireDate)}`,
    `2、劳动合同期限：${field(data.contractTerm)}`,
    `3、劳动合同签订后，自签订日期起，试用期为 ${field(data.probationMonths)} 个月，试用期工资为 ${field(money(data.probationSalary))}`,
    `4、入职岗位：${field(data.position)}，使用机器约定：${field(data.machineAgreement)}`,
    `5、本人的工资计算方式为 ${field(data.wageMethod)}`,
    '6、辞工必须递交书面辞工书，经领导审批后一个月之后方可离开工作岗位！',
    '7、认真做好本职工作，服从主管的安排！',
  ].join('<br />');
}

function hrOpinionText(record: OnboardingRecord) {
  return [
    field(record.hrOpinion || '同意入职。'),
    `审核人：${field(record.reviewerName)}`,
  ].join('&nbsp;&nbsp;&nbsp;');
}

function cell(content: string, className = '', attrs = '') {
  return `<td ${attrs} class="${className}">${content}</td>`;
}

function label(content: string, attrs = '') {
  return `<th ${attrs}>${escapeHtml(content)}</th>`;
}

function buildOfficialPrintHtml(record: OnboardingRecord) {
  const data = record.data;
  const contact = data.emergencyContacts[0] || { name: '', relation: '', address: '', phone: '' };
  const signature = data.signatureDataUrl?.startsWith('data:image/') ? data.signatureDataUrl : '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${field(record.name)}-入职登记表打印</title>
  <style>
    @page { size: A4; margin: 18.7mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #e5e7eb;
      color: #111;
      font-family: SimSun, "宋体", "Microsoft YaHei", Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.25;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 18px;
      background: #fff;
      border-bottom: 1px solid #d1d5db;
    }
    .toolbar a,
    .toolbar button {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      color: #111827;
      padding: 7px 14px;
      cursor: pointer;
      font-size: 13px;
      text-decoration: none;
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
      padding: 0;
      background: #fff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .sheet {
      width: 172.5mm;
      margin: 0 auto;
      padding: 7mm 0 0;
    }
    .promise-page .sheet {
      padding-top: 6mm;
      min-height: 276mm;
      display: flex;
      flex-direction: column;
    }
    h1 {
      margin: 0 0 8px;
      text-align: center;
      font-family: SimSun, "宋体", serif;
      font-size: 18pt;
      font-weight: 700;
      letter-spacing: 2px;
    }
    .topline {
      display: flex;
      justify-content: space-between;
      margin: 0 0 2mm;
      font-size: 10.5pt;
    }
    table.official {
      width: 172.5mm;
      border-collapse: collapse;
      table-layout: fixed;
      border: 1px solid #111;
    }
    .official th,
    .official td {
      border: 1px solid #111;
      padding: 0 1.9mm;
      height: 9mm;
      vertical-align: middle;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .official th {
      text-align: center;
      font-weight: 400;
      background: #fff;
      white-space: nowrap;
    }
    .section {
      width: 9.9mm;
      text-align: center;
      font-weight: 700;
      line-height: 1.45;
      white-space: pre-line;
    }
    .center { text-align: center; }
    .photo {
      height: 36mm;
      text-align: center;
      font-size: 12pt;
      letter-spacing: 2mm;
      line-height: 1.8;
    }
    .row-normal th,
    .row-normal td { height: 9mm; }
    .row-emergency th,
    .row-emergency td { height: 9mm; }
    .row-health th,
    .row-health td { height: 38mm; }
    .row-notice th,
    .row-notice td { height: 60mm; }
    .row-opinion th,
    .row-opinion td { height: 20mm; }
    .wide-text {
      line-height: 1.45;
    }
    .notice {
      line-height: 1.5;
      font-size: 10.5pt;
    }
    .opinion {
      text-align: center;
      font-size: 10.5pt;
    }
    .remark {
      margin: 2mm 0 0;
      font-size: 10.5pt;
    }
    .promise-title {
      margin: 0 0 7mm;
      text-align: center;
      font-size: 17pt;
      font-weight: 700;
      letter-spacing: 4px;
    }
    .promise {
      margin: 0 0 2.7mm;
      text-indent: 2em;
      font-size: 11pt;
      line-height: 1.55;
    }
    .signature-line {
      margin-top: auto;
      padding-top: 7mm;
      text-align: right;
      font-size: 11pt;
      line-height: 1.75;
    }
    .signature-img {
      max-width: 120px;
      max-height: 42px;
      vertical-align: middle;
    }
    @media print {
      body { background: #fff; }
      .toolbar { display: none; }
      .page {
        width: auto;
        min-height: auto;
        margin: 0;
        box-shadow: none;
      }
      .sheet {
        width: 172.5mm;
        padding: 0;
      }
      .promise-page .sheet {
        min-height: 259mm;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" onclick="window.close()">关闭</button>
    <a href="/api/onboarding/${record.id}/export" target="_blank" rel="noreferrer">下载同版登记表</a>
    <button type="button" class="primary" onclick="window.print()">打印</button>
  </div>

  <main>
    <section class="page form-page">
      <div class="sheet">
        <h1>入职登记表</h1>
        <div class="topline">
          <span>岗位：${field(data.position)}</span>
          <span>填表日期：${formatChineseDate(data.fillDate)}</span>
        </div>

        <table class="official">
          <colgroup>
            <col style="width: 6%" />
            <col style="width: 10%" />
            <col style="width: 16%" />
            <col style="width: 10%" />
            <col style="width: 15%" />
            <col style="width: 10%" />
            <col style="width: 15%" />
            <col style="width: 18%" />
          </colgroup>
          <tbody>
            <tr class="row-normal">
              ${label('招聘来源', 'colspan="2"')}
              ${cell(recruitmentSourceText(record), '', 'colspan="5"')}
              ${cell('相<br />片', 'photo', 'rowspan="4"')}
            </tr>
            <tr class="row-normal">
              ${cell('个<br />人<br />基<br />本<br />信<br />息', 'section', 'rowspan="5"')}
              ${label('姓 名')}
              ${cell(field(data.name))}
              ${label('性 别')}
              ${cell(field(data.gender))}
              ${label('民 族')}
              ${cell(field(data.ethnicity))}
            </tr>
            <tr class="row-normal">
              ${label('籍 贯')}
              ${cell(field(data.nativePlace))}
              ${label('学 历')}
              ${cell(field(data.education))}
              ${label('政治面貌')}
              ${cell(field(data.politicalStatus))}
            </tr>
            <tr class="row-normal">
              ${label('婚姻状况')}
              ${cell(optionLine(['已婚有子女', '已婚无子女', '未婚', '其他'], data.maritalStatus), '', 'colspan="5"')}
            </tr>
            <tr class="row-normal">
              ${label('身份证号')}
              ${cell(field(data.idCard), '', 'colspan="2"')}
              ${label('联系电话')}
              ${cell(field(data.phone), '', 'colspan="3"')}
            </tr>
            <tr class="row-normal">
              ${label('微信/QQ')}
              ${cell(field(data.wechat), '', 'colspan="2"')}
              ${label('邮箱')}
              ${cell(field(data.email), '', 'colspan="3"')}
            </tr>

            <tr class="row-normal">
              ${cell('紧<br />急<br />联<br />系<br />人', 'section', 'rowspan="2"')}
              ${label('姓名')}
              ${cell(field(contact.name))}
              ${label('关系')}
              ${cell(field(contact.relation))}
              ${label('单位住址')}
              ${cell(field(contact.address), '', 'colspan="2"')}
            </tr>
            <tr class="row-normal">
              ${label('联系电话')}
              ${cell(field(contact.phone), '', 'colspan="6"')}
            </tr>

            <tr class="row-health">
              ${cell('健<br />康<br />信<br />息', 'section')}
              ${cell(healthText(record), 'wide-text', 'colspan="7"')}
            </tr>

            <tr class="row-notice">
              ${cell('入<br />厂<br />须<br />知', 'section')}
              ${cell(noticeText(record), 'notice', 'colspan="7"')}
            </tr>

            <tr class="row-opinion">
              ${label('主管部门意见', 'colspan="2"')}
              ${cell('', 'opinion', 'colspan="2"')}
              ${label('人事部门意见')}
              ${cell(hrOpinionText(record), 'opinion')}
              ${label('总经理审批')}
              ${cell('', 'opinion')}
            </tr>
          </tbody>
        </table>

        <p class="remark">备注：请在填写前认真阅读背面“入职承诺”，并签字确认。</p>
      </div>
    </section>

    <section class="page promise-page">
      <div class="sheet">
        <h2 class="promise-title">入 职 承 诺</h2>
        <p class="promise">1. 本人在填写本《入职登记表》时，已保证自己符合国家法定的劳动年龄的标准，且与其他任何用人单位、机构、组织、团体无劳动关系；若违反前述承诺，导致用人单位被追究有关经济责任的，所有责任均由本人承担。</p>
        <p class="promise">2. 本人在填写《入职登记表》时，用人单位已如实告知工作内容、工作地点、工作条件、职业危害、安全生产状况、劳动报酬以及本人所需要了解的所有情况。</p>
        <p class="promise">3. 本人如有传染病、精神病或其他可能影响在用人单位工作的病史，本人应以书面形式向用人单位说明。</p>
        <p class="promise">4. 本人承诺已与原单位解除劳动关系，且无仍然生效的保密协议、竞业限制协议。</p>
        <p class="promise">5. 本人填写的《入职登记表》所有信息真实有效，如有任何虚假，用人单位可按严重违反规章制度解除劳动合同，同时承担因此引起的所有责任。</p>
        <p class="promise">6. 本人承诺对用人单位相关信息（包括但不限于工资）承担保密责任。</p>
        <p class="promise">7. 如《入职登记表》中的信息有变化，本人有责任以书面形式向用人单位人事部门提交最新的信息。</p>
        <p class="promise">8. 本人承诺只可使用本表列明的机械，擅自使用其他机械后果自负。</p>
        <p class="promise">9. 企业为本人出资购买的各种保险，在保险事故发生后，保险公司的理赔款作为企业赔偿给本人的一部分。</p>
        <p class="promise">10. 本人承诺在一个月内与用人单位签订劳动合同，本人将认真阅读并遵守各项规章制度。</p>
        <p class="promise">11. 本人承诺在用人单位任职期间不从事任何兼职行为。</p>
        <p class="promise">12. 本人所填写的通讯方式（包括地址、QQ、邮箱、手机）均为有效，用人单位向任一通讯方式寄送或发出的文件或物品，如果发生收件人拒绝签收和已发送成功均视为送达。</p>
        <p class="promise">13. 本人承诺无被追究刑事责任记录，如有，有责任以书面形式告知用人单位，如隐瞒事实真相，一切法律后果由本人承担。</p>
        <p class="promise">本人已充分了解上述资料的真实性是双方订立劳动合同的前提条件，本人填写的以上任何信息虚假或没有履行以上特别说明的义务，无论任何时候被发现，本人均同意被用人单位视为严重违反《中华人民共和国劳动合同法》的诚实信用原则以及用人单位的规章制度，用人单位可以解除劳动合同且不用支付经济补偿金。</p>

        <div class="signature-line">
          签&nbsp;&nbsp;名：
          ${signature ? `<img class="signature-img" src="${signature}" alt="员工签名" />` : field(data.name)}
          <br />
          日&nbsp;&nbsp;期：${formatChineseDate(data.signatureDate)}
        </div>
      </div>
    </section>
  </main>

  <script>
    window.addEventListener('load', function () {
      window.setTimeout(function () { window.print(); }, 300);
    });
  </script>
</body>
</html>`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const rowData = db.prepare('SELECT * FROM onboarding_records WHERE id = ?').get(id) as OnboardingDbRow | undefined;
    if (!rowData) {
      return NextResponse.json({ success: false, error: '入职登记不存在' }, { status: 404 });
    }

    const record = parseOnboardingRow(rowData);
    if (record.status === '待审核') {
      return NextResponse.json({ success: false, error: '请先完成人事审核，审核后才能打印' }, { status: 400 });
    }

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'personnel',
      action: 'print',
      details: { onboardingId: id, employeeName: record.name },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return new NextResponse(buildOfficialPrintHtml(record), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Print onboarding record error:', error);
    return NextResponse.json({ success: false, error: '打开打印页失败' }, { status: 500 });
  }
}
