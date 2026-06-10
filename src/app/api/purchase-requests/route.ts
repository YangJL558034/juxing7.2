import { NextRequest, NextResponse } from 'next/server';
import { query, getSubordinateUserIds, getApproverChain, generateDocNo, db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { chinaNowSql } from '@/lib/china-time';

// 获取请购单列表
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
    
    // 获取 query 参数，判断是否是审批中心调用
    const url = new URL(request.url);
    const isApprovalCenter = url.searchParams.get('approval') === 'true';
    
    let requests;
    
    if (isApprovalCenter) {
      // 审批中心/财务终审：
      if (user.role === 'admin') {
        // 管理员：返回所有可能涉及财务终审的单据
        requests = db.prepare(`
          SELECT DISTINCT pr.* 
          FROM purchase_requests pr
          LEFT JOIN approval_records ar ON pr.id = ar.doc_id AND ar.doc_type = 'purchase_request'
          WHERE 
            -- 待当前审批人审批的单据
            pr.current_approver_id = ? 
            -- 待财务终审的单据
            OR (pr.status = '一审已通过待二审' AND pr.current_approver_id IS NULL)
            -- 有财务终审记录的单据
            OR ar.approval_order >= 2
          ORDER BY pr.created_at DESC
        `).all(userId) as Array<Record<string, unknown>>;
      } else {
        // 普通用户：只能看到待审批的单据和自己审批过的已完成单据
        requests = db.prepare(`
          SELECT DISTINCT pr.* 
          FROM purchase_requests pr
          LEFT JOIN approval_records ar ON pr.id = ar.doc_id AND ar.doc_type = 'purchase_request'
          WHERE 
            -- 待当前用户审批的单据（状态为待审批）
            (pr.current_approver_id = ? AND pr.status = '待审批')
            -- 自己审批过的已完成单据（状态为已通过或已驳回）
            OR (ar.approver_id = ? AND pr.status IN ('已通过', '已驳回'))
          ORDER BY pr.created_at DESC
        `).all(userId, userId) as Array<Record<string, unknown>>;
      }
    } else {
      // 请购单管理页面：只显示自己申请的单据
      requests = db.prepare(`
        SELECT * FROM purchase_requests 
        WHERE applicant_id = ?
        ORDER BY created_at DESC
      `).all(userId) as Array<Record<string, unknown>>;
    }

    // 获取每条记录的审批记录
    const requestsWithApprovals = requests.map(req => {
      const approvals = query.approvalRecords.getByDoc.all('purchase_request', req.id as number) as Array<Record<string, unknown>>;
      return { ...req, approvals };
    });

    return NextResponse.json({ requests: requestsWithApprovals });
  } catch (error) {
    console.error('获取请购单列表失败:', error);
    return NextResponse.json({ error: '获取请购单列表失败' }, { status: 500 });
  }
}

// 创建请购单
export async function POST(request: NextRequest) {
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
    const user = query.findUserById.get(userId) as { id: number; name: string; department?: string; employee_id?: number };
    
    const body = await request.json();
    const { title, items, total_amount, reason, urgency, proof_file, proof_file_name, department, approver_id } = body;

    if (!title || !items || !approver_id) {
      return NextResponse.json({ error: '请填写完整信息，包括审批人' }, { status: 400 });
    }

    // 获取审批人信息
    const approver = query.findUserById.get(approver_id) as { id: number; name: string; email?: string } | undefined;
    if (!approver) {
      return NextResponse.json({ error: '审批人不存在' }, { status: 400 });
    }

    // 生成单据编号
    const requestNo = generateDocNo('PR');

    // 创建请购单
    const result = query.purchaseRequests.create.run(
      requestNo,
      title,
      userId,
      user.name,
      department || user.department || '',
      JSON.stringify(items),
      total_amount || 0,
      reason || '',
      urgency || '普通',
      proof_file || null,
      proof_file_name || null
    );

    const requestId = result.lastInsertRowid;

    // 设置审批人并发送通知
    db.prepare('UPDATE purchase_requests SET current_approver_id = ?, current_approver_name = ? WHERE id = ?').run(
      approver.id,
      approver.name,
      requestId
    );

    // 发送站内消息（消息中心）
    query.messages.create.run(
      approver.id,
      `请购单审批通知`,
      `${user.name} 提交了请购单「${title}」，金额 ¥${total_amount || 0}，请您审批。`,
      'approval',
      'purchase_request',
      requestId
    );
    
    // 获取当前本地时间
    const localTime = chinaNowSql();
    
    // 写入通知中心记录
    const notificationResult = db.prepare(`
      INSERT INTO notifications (title, content, sender_id, sender_name, receiver_id, receiver_name, type, email_sent, email_error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      '请购单审批通知',
      `${user.name} 提交了请购单「${title}」，金额 ¥${total_amount || 0}，请您审批。`,
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

    // 发送邮件通知
    if (approver.email) {
      const emailResult = await sendEmail(
        approver.email,
        '请购单审批通知',
        `${user.name} 提交了请购单「${title}」，金额 ¥${total_amount || 0}，请您登录系统进行审批。`
      );
      if (emailResult.success) {
        db.prepare('UPDATE notifications SET email_sent = 1 WHERE id = ?').run(notificationId);
      } else if (emailResult.error) {
        db.prepare('UPDATE notifications SET email_error = ? WHERE id = ?').run(emailResult.error, notificationId);
      }
    }

    return NextResponse.json({ 
      success: true, 
      id: requestId,
      request_no: requestNo,
      message: '请购单提交成功，已通知审批人' 
    });
  } catch (error) {
    console.error('创建请购单失败:', error);
    return NextResponse.json({ error: '创建请购单失败' }, { status: 500 });
  }
}
