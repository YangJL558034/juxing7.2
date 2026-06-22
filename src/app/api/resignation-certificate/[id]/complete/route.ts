import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { parseResignationCertificateRow, type ResignationCertificateDbRow } from '@/lib/resignation-certificate-records';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function queryLink(request: NextRequest) {
  const origin = new URL(request.url).origin;
  return `${origin}/resignation-certificate?query=1`;
}

function formatEmailError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || '未知错误');
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    if (!user) return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });

    const row = db.prepare('SELECT * FROM resignation_certificate_records WHERE id = ? AND deleted_at IS NULL').get(id) as ResignationCertificateDbRow | undefined;
    if (!row) return NextResponse.json({ success: false, error: '离职证明申请不存在或已删除' }, { status: 404 });
    if (!row.stamped_file_data) return NextResponse.json({ success: false, error: '请先上传已盖章离职证明，再点击完成' }, { status: 400 });

    const record = parseResignationCertificateRow(row);
    const reviewerName = record.data.reviewerName || user.name || user.username || '';
    const link = queryLink(request);
    const honorific = record.honorific === '先生' ? '先生' : '女士';

    let emailSent = false;
    let emailError: string | null = null;

    if (record.email) {
      const subject = '离职证明已完成，请查询下载';
      const content = `
        <div style="font-family:Arial,'Microsoft YaHei',sans-serif;font-size:14px;line-height:1.8;color:#111827;">
          <p>尊敬的${record.employeeName}${honorific}：</p>
          <p>您在本公司提交的离职证明申请已经审核完成，公司已上传盖章版离职证明。</p>
          <p>请点击以下链接进入离职证明查询入口，输入申请人姓名和身份证号码后查看并下载：</p>
          <p><a href="${link}" style="color:#2563eb;">${link}</a></p>
          <p>移动端查询入口仅保留半个月，超过半个月后如需再次获取，请联系公司人事部门。</p>
        </div>
      `;

      try {
        const emailResult = await sendEmail(record.email, subject, content);
        if (emailResult.success) {
          emailSent = true;
        } else {
          emailError = emailResult.error || '邮件发送失败';
        }
      } catch (error) {
        emailError = formatEmailError(error);
      }
    } else {
      emailError = '申请人邮箱为空，未发送邮件';
    }

    db.prepare(`
      UPDATE resignation_certificate_records
      SET status = '已完成',
          reviewer_name = ?,
          reviewed_at = COALESCE(reviewed_at, datetime('now', '+8 hours')),
          completed_at = COALESCE(completed_at, datetime('now', '+8 hours')),
          email_sent_at = ${emailSent ? "datetime('now', '+8 hours')" : 'NULL'},
          email_error = ?,
          updated_at = datetime('now', '+8 hours')
      WHERE id = ?
    `).run(reviewerName, emailError, id);

    const updated = db.prepare('SELECT * FROM resignation_certificate_records WHERE id = ?').get(id) as ResignationCertificateDbRow;
    return NextResponse.json({
      success: true,
      record: parseResignationCertificateRow(updated),
      emailSent,
      emailError,
      message: emailSent
        ? '离职证明已完成，邮件已发送'
        : `离职证明已完成，但邮件未发送成功：${emailError || '未知错误'}`,
    });
  } catch (error) {
    console.error('Complete resignation certificate record error:', error);
    return NextResponse.json({ success: false, error: '完成离职证明失败' }, { status: 500 });
  }
}
