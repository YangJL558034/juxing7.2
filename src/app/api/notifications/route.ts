import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

// 发送邮件函数（使用 Resend 或其他邮件服务）
async function sendEmail(to: string, subject: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 这里使用 Resend API 发送邮件
    // 需要设置环境变量 RESEND_API_KEY
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      console.log('未配置邮件API密钥，跳过邮件发送');
      return { success: false, error: '未配置邮件API密钥' };
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: '聚星数据平台 <noreply@juxing.com>',
        to: to,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
              <h2 style="margin: 0;">聚星数据平台通知</h2>
            </div>
            <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
              <h3 style="color: #333;">${subject}</h3>
              <p style="color: #666; line-height: 1.6;">${content}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
            </div>
          </div>
        `,
      }),
    });

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// GET - 获取通知列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const receiverId = searchParams.get('receiverId');
    const senderId = searchParams.get('senderId');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    let notifications;
    
    if (receiverId) {
      if (unreadOnly) {
        notifications = query.notifications.getUnreadByReceiver.all(parseInt(receiverId));
      } else {
        notifications = query.notifications.getByReceiver.all(parseInt(receiverId));
      }
    } else if (senderId) {
      notifications = query.notifications.getBySender.all(parseInt(senderId));
    } else {
      notifications = query.notifications.getAll.all();
    }

    return NextResponse.json({ success: true, data: notifications });
  } catch (error) {
    console.error('获取通知失败:', error);
    return NextResponse.json({ success: false, error: '获取通知失败' }, { status: 500 });
  }
}

// POST - 发送通知
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, senderId, senderName, receiverIds, sendToAll, type = 'info', sendEmail: shouldSendEmail = true } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: '通知标题不能为空' }, { status: 400 });
    }

    // 获取接收者列表
    let receivers: Array<{ id: number; name: string; email?: string }> = [];
    
    if (sendToAll) {
      // 发送给所有用户
      const users = query.getAllUsers.all() as Array<{ id: number; name: string; email?: string }>;
      receivers = users.map(u => ({ id: u.id, name: u.name, email: u.email }));
    } else if (receiverIds && receiverIds.length > 0) {
      // 发送给指定用户
      for (const id of receiverIds) {
        const user = query.findUserById.get(id) as { id: number; name: string; email?: string } | undefined;
        if (user) {
          receivers.push({ id: user.id, name: user.name, email: user.email });
        }
      }
    }

    if (receivers.length === 0) {
      return NextResponse.json({ success: false, error: '没有有效的接收者' }, { status: 400 });
    }

    const results: Array<{ receiverId: number; receiverName: string; success: boolean; emailSent: boolean; emailError?: string }> = [];

    // 为每个接收者创建通知
    for (const receiver of receivers) {
      let emailSent = 0;
      let emailError = '';

      // 发送邮件
      if (shouldSendEmail && receiver.email) {
        const emailResult = await sendEmail(receiver.email, title, content || '');
        if (emailResult.success) {
          emailSent = 1;
        } else {
          emailError = emailResult.error || '邮件发送失败';
        }
      }

      // 保存通知到数据库
      query.notifications.create.run(
        title,
        content || '',
        senderId || null,
        senderName || '系统',
        receiver.id,
        receiver.name,
        type,
        emailSent,
        emailError
      );

      results.push({
        receiverId: receiver.id,
        receiverName: receiver.name,
        success: true,
        emailSent: emailSent === 1,
        emailError: emailError || undefined,
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `成功发送通知给 ${receivers.length} 个用户`,
      data: results 
    });
  } catch (error) {
    console.error('发送通知失败:', error);
    return NextResponse.json({ success: false, error: '发送通知失败' }, { status: 500 });
  }
}

// PUT - 标记通知已读
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, receiverId, markAll } = body;

    if (markAll && receiverId) {
      // 标记所有通知已读
      query.notifications.markAllAsRead.run(receiverId);
      return NextResponse.json({ success: true, message: '已标记所有通知为已读' });
    } else if (notificationId) {
      // 标记单个通知已读
      query.notifications.markAsRead.run(notificationId);
      return NextResponse.json({ success: true, message: '已标记为已读' });
    }

    return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
  } catch (error) {
    console.error('标记已读失败:', error);
    return NextResponse.json({ success: false, error: '标记已读失败' }, { status: 500 });
  }
}

// DELETE - 删除通知
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const receiverId = searchParams.get('receiverId');
    const deleteAll = searchParams.get('deleteAll') === 'true';

    if (deleteAll && receiverId) {
      // 删除指定接收者的所有通知
      query.notifications.deleteByReceiver.run(parseInt(receiverId));
      return NextResponse.json({ success: true, message: '所有通知已删除' });
    } else if (id) {
      // 删除单个通知
      query.notifications.delete.run(parseInt(id));
      return NextResponse.json({ success: true, message: '通知已删除' });
    }

    return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
  } catch (error) {
    console.error('删除通知失败:', error);
    return NextResponse.json({ success: false, error: '删除通知失败' }, { status: 500 });
  }
}
