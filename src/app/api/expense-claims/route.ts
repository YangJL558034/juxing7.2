import { NextRequest, NextResponse } from 'next/server';
import { query, db, generateDocNo } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }
    const userId = decoded.id;
    const user = query.findUserById.get(userId) as { id: number; name: string; role: string };
    const url = new URL(request.url);
    const isApprovalCenter = url.searchParams.get('approval') === 'true';
    let claims;
    if (isApprovalCenter) {
      // 审批中心/财务终审：
      if (user.role === 'admin') {
        // 管理员：返回所有可能涉及财务终审的单据
        claims = db.prepare(`
          SELECT DISTINCT ec.* 
          FROM expense_claims ec
          LEFT JOIN approval_records ar ON ec.id = ar.doc_id AND ar.doc_type = 'expense_claim'
          WHERE 
            -- 待当前审批人审批的单据
            ec.current_approver_id = ? 
            -- 待财务终审的单据
            OR (ec.status = '一审已通过待二审' AND ec.current_approver_id IS NULL)
            -- 有财务终审记录的单据
            OR ar.approval_order >= 2
          ORDER BY ec.created_at DESC
        `).all(userId);
      } else {
        claims = db.prepare(`
          SELECT ec.* FROM expense_claims ec
          WHERE ec.current_approver_id = ?
          ORDER BY ec.created_at DESC
        `).all(userId);
      }
    } else {
      claims = db.prepare(`SELECT * FROM expense_claims WHERE applicant_id = ? ORDER BY created_at DESC`).all(userId);
    }
    const claimsWithApprovals = claims.map((claim: any) => {
      const approvals = query.approvalRecords.getByDoc.all('expense_claim', claim.id);
      return { ...claim, approvals };
    });
    return NextResponse.json({ claims: claimsWithApprovals });
  } catch (error) {
    console.error('获取费用报销单列表失败:', error);
    return NextResponse.json({ error: '获取费用报销单列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    const userId = decoded.id;
    const user = query.findUserById.get(userId) as { id: number; name: string; department?: string };
    const body = await request.json();
    const { title, expense_type, expense_date, items, total_amount, description, proof_file, proof_file_name, department, approver_id } = body;
    if (!title || !items || !expense_type || !approver_id) {
      return NextResponse.json({ error: '请填写完整信息，包括审批人' }, { status: 400 });
    }
    const approver = query.findUserById.get(approver_id) as { id: number; name: string; email?: string } | undefined;
    if (!approver) return NextResponse.json({ error: '审批人不存在' }, { status: 400 });
    console.log('[Email] 审批人信息:', { id: approver.id, name: approver.name, email: approver.email || '空' });
    const claimNo = generateDocNo('EC');
    const result = query.expenseClaims.create.run(claimNo, title, userId, user.name, department || user.department || '', expense_type, expense_date || null, JSON.stringify(items), total_amount || 0, description || '', proof_file || null, proof_file_name || null);
    const claimId = result.lastInsertRowid;
    db.prepare('UPDATE expense_claims SET current_approver_id = ?, current_approver_name = ? WHERE id = ?').run(approver.id, approver.name, claimId);
    
    // 发送站内消息（消息中心）
    query.messages.create.run(approver.id, '费用报销审批通知', `${user.name} 提交了费用报销单「${title}」，金额 ¥${total_amount || 0}，请您审批。`, 'approval', 'expense_claim', claimId);
    
    // 获取当前本地时间
    const now = new Date();
    const localTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    // 写入通知中心记录
    const notificationResult = db.prepare(`
      INSERT INTO notifications (title, content, sender_id, sender_name, receiver_id, receiver_name, type, email_sent, email_error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      '费用报销审批通知',
      `${user.name} 提交了费用报销单「${title}」，金额 ¥${total_amount || 0}，请您审批。`,
      user.id,
      user.name,
      approver.id,
      approver.name,
      'approval',
      0,
      null,
      localTime
    );
    const notificationId = notificationResult.lastInsertRowid as number;
    
    // 发送邮件通知给审批人
    if (approver.email) {
      const emailResult = await sendEmail(
        approver.email,
        '费用报销审批通知',
        `${user.name} 提交了费用报销单「${title}」，金额 ¥${total_amount || 0}，请您登录系统进行审批。`
      );
      if (emailResult.success) {
        db.prepare('UPDATE notifications SET email_sent = 1 WHERE id = ?').run(notificationId);
      } else if (emailResult.error) {
        db.prepare('UPDATE notifications SET email_error = ? WHERE id = ?').run(emailResult.error, notificationId);
      }
    }
    
    return NextResponse.json({ success: true, id: claimId, claim_no: claimNo, message: '费用报销单提交成功，已通知审批人' });
  } catch (error) {
    console.error('创建费用报销单失败:', error);
    return NextResponse.json({ error: '创建费用报销单失败' }, { status: 500 });
  }
}
