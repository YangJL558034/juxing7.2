import { NextRequest, NextResponse } from 'next/server';
import { db, query } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

function getTokenFromHeader(cookie: string | null): string | null {
  if (!cookie) return null;
  const match = cookie.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

function getToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }
  return getTokenFromHeader(request.headers.get('cookie'));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = getToken(request);
    if (!token) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const userId = decoded.id;
    const user = query.findUserById.get(userId) as { id: number; name: string; role: string };
    
    const body = await request.json();
    const { action, comment } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '无效的审批操作' }, { status: 400 });
    }

    const purchaseRequest = query.purchaseRequests.getById.get(parseInt(id)) as {
      id: number;
      request_no: string;
      title: string;
      applicant_id: number;
      applicant_name: string;
      status: string;
      total_amount: number;
      current_approver_id: number | null;
    } | undefined;

    if (!purchaseRequest) {
      return NextResponse.json({ error: '请购单不存在' }, { status: 404 });
    }

    // 检查权限：
    // 1. 如果状态是"待审批"，只有分配的审批人可以审批
    // 2. 如果状态是"一审已通过待二审"，所有管理员都可以审批
    let canApprove = false;
    if (purchaseRequest.status === '待审批') {
      canApprove = purchaseRequest.current_approver_id === userId;
    } else if (purchaseRequest.status === '一审已通过待二审') {
      canApprove = user.role === 'admin';
    }
    
    if (!canApprove) {
      return NextResponse.json({ error: '当前单据不由您审批' }, { status: 403 });
    }

    const nextOrderResult = query.approvalRecords.getNextOrder.get('purchase_request', parseInt(id)) as { next_order: number };
    const approvalOrder = nextOrderResult.next_order;

    query.approvalRecords.create.run(
      'purchase_request',
      parseInt(id),
      purchaseRequest.request_no,
      userId,
      user.name,
      action === 'approve' ? 'approved' : 'rejected',
      comment || null,
      approvalOrder
    );

    if (action === 'reject') {
      query.purchaseRequests.updateStatus.run('已驳回', null, null, parseInt(id));

      query.messages.create.run(
        purchaseRequest.applicant_id,
        '请购单审批结果通知',
        `您的请购单「${purchaseRequest.title}」已被 ${user.name} 驳回。${comment ? `原因：${comment}` : ''}`,
        'approval_result',
        'purchase_request',
        parseInt(id)
      );

      // 获取申请人信息，发送邮件通知
      const applicant = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(purchaseRequest.applicant_id) as { id: number; name: string; email?: string };
      if (applicant && applicant.email) {
        console.log(`[Email] 发送给申请人: ${applicant.name} <${applicant.email}>`);
        await sendEmail(
          applicant.email,
          '请购单审批驳回通知',
          `您的请购单「${purchaseRequest.title}」已被 ${user.name} 驳回。${comment ? `原因：${comment}` : ''}`
        );
      }

      return NextResponse.json({ success: true, message: '已驳回该请购单' });
    }

    // 审批通过流程
    // 如果当前状态是"一审已通过待二审"（财务终审），则完成审批
    if (purchaseRequest.status === '一审已通过待二审') {
      query.purchaseRequests.updateStatus.run('已通过', null, null, parseInt(id));

      query.messages.create.run(
        purchaseRequest.applicant_id,
        '请购单审批结果通知',
        `您的请购单「${purchaseRequest.title}」已全部审批通过，可以执行采购。`,
        'approval_result',
        'purchase_request',
        parseInt(id)
      );

      // 获取申请人信息，发送邮件通知
      const applicant = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(purchaseRequest.applicant_id) as { id: number; name: string; email?: string };
      if (applicant && applicant.email) {
        console.log(`[Email] 发送给申请人: ${applicant.name} <${applicant.email}>`);
        await sendEmail(
          applicant.email,
          '请购单审批通过通知',
          `您的请购单「${purchaseRequest.title}」已全部审批通过，可以执行采购。`
        );
      }

      return NextResponse.json({ success: true, message: '财务终审通过，流程已完成' });
    }

    // 一级审批通过，流转到财务终审
    // 设置状态为"一审已通过待二审"，清空当前审批人（让所有管理员可见）
    db.prepare('UPDATE purchase_requests SET status = ?, current_approver_id = NULL, current_approver_name = NULL WHERE id = ?').run(
      '一审已通过待二审',
      parseInt(id)
    );

    // 获取所有管理员，发送通知
    const admins = db.prepare('SELECT id, name, email FROM users WHERE role = ?').all('admin') as Array<{ id: number; name: string; email?: string }>;
    for (const admin of admins) {
      // 发送站内消息（消息中心）
      query.messages.create.run(
        admin.id,
        '请购单财务终审通知',
        `${user.name} 已通过请购单「${purchaseRequest.title}」，金额 ¥${purchaseRequest.total_amount}，请进行财务终审。`,
        'approval',
        'purchase_request',
        parseInt(id)
      );
      
      // 获取当前本地时间
      const now = new Date();
      const localTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      // 写入通知中心记录
      const notificationResult = db.prepare(`
        INSERT INTO notifications (title, content, sender_id, sender_name, receiver_id, receiver_name, type, email_sent, email_error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        '请购单财务终审通知',
        `${user.name} 已通过请购单「${purchaseRequest.title}」，金额 ¥${purchaseRequest.total_amount}，请进行财务终审。`,
        user.id,
        user.name,
        admin.id,
        admin.name,
        'approval',
        0,
        null,
        localTime
      );
      const notificationId = notificationResult.lastInsertRowid as number;
      
      // 发送邮件通知给管理员
      if (admin.email) {
        console.log(`[Email] 发送给管理员: ${admin.name} <${admin.email}>`);
        const emailResult = await sendEmail(
          admin.email,
          '请购单财务终审通知',
          `${user.name} 已通过请购单「${purchaseRequest.title}」，金额 ¥${purchaseRequest.total_amount}，请登录系统进行财务终审。`
        );
        if (emailResult.success) {
          db.prepare('UPDATE notifications SET email_sent = 1 WHERE id = ?').run(notificationId);
          console.log(`[Email] 发送成功: ${admin.email}`);
        } else if (emailResult.error) {
          db.prepare('UPDATE notifications SET email_error = ? WHERE id = ?').run(emailResult.error, notificationId);
          console.log(`[Email] 发送失败: ${admin.email} - ${emailResult.error}`);
        }
      }
    }

    return NextResponse.json({ success: true, message: '一级审批通过，已流转至财务终审' });

  } catch (error) {
    console.error('审批请购单失败:', error);
    return NextResponse.json({ error: '审批请购单失败' }, { status: 500 });
  }
}
