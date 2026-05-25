import { db } from './database';
import * as nodemailer from 'nodemailer';

interface SmtpConfig {
  host: string;
  port: number;
  secure: number;
  user: string;
  pass: string;
  from_email: string;
}

// 生成6位验证码
export function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 保存验证码到数据库
export function saveVerificationCode(email: string, code: string, type: string): void {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5分钟后过期
  db.prepare(`
    INSERT INTO verification_codes (email, code, type, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(email, code, type, now.toISOString(), expiresAt.toISOString());
}

// 验证验证码
export function verifyCode(email: string, code: string): boolean {
  const record = db.prepare(`
    SELECT * FROM verification_codes 
    WHERE email = ? AND code = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(email, code) as any;
  
  if (!record) {
    return false;
  }
  
  // 检查验证码是否在5分钟内有效
  const created = new Date(record.created_at);
  const now = new Date();
  const diff = (now.getTime() - created.getTime()) / 1000 / 60;
  
  return diff <= 5;
}

// 发送验证码邮件
export async function sendVerificationCode(email: string, code: string, type: string): Promise<{ success: boolean; error?: string }> {
  let subject = '';
  let content = '';
  
  if (type === 'register') {
    subject = '【聚星数据平台】注册验证码';
    content = `欢迎注册聚星数据平台！您的注册验证码是：<strong>${code}</strong>，5分钟内有效。`;
  } else {
    subject = '【聚星数据平台】密码重置验证码';
    content = `您正在重置密码，验证码是：<strong>${code}</strong>，5分钟内有效。如果不是您本人操作，请忽略此邮件。`;
  }
  
  const result = await sendEmail(email, subject, content);
  
  return result;
}

function getSmtpConfig(): SmtpConfig | null {
  try {
    const config = db.prepare('SELECT * FROM smtp_config ORDER BY id DESC LIMIT 1').get() as SmtpConfig | undefined;
    console.log('[Email] 获取SMTP配置:', config ? `host=${config.host}, port=${config.port}, user=${config.user ? '***' : '空'}, from_email=${config.from_email}` : '未找到配置');
    return config || null;
  } catch (error: any) {
    console.error('[Email] 获取SMTP配置失败:', error.message);
    return null;
  }
}

export async function sendEmail(to: string, subject: string, content: string, attachment?: { filePath: string; fileName: string }): Promise<{ success: boolean; error?: string }> {
  if (!to || !to.trim()) {
    console.log('[Email] 收件人邮箱为空，跳过发送');
    return { success: false, error: '收件人邮箱为空' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    console.log(`[Email] 收件人邮箱格式无效: ${to}`);
    return { success: false, error: '收件人邮箱格式无效' };
  }
  
  const config = getSmtpConfig();
  
  if (!config) {
    console.log('[Email] SMTP配置为空');
    return { success: false, error: 'SMTP配置为空' };
  }
  
  if (!config.host) {
    console.log('[Email] SMTP主机地址为空');
    return { success: false, error: 'SMTP主机地址未配置' };
  }
  
  if (!config.user) {
    console.log('[Email] SMTP用户名为空');
    return { success: false, error: 'SMTP用户名未配置' };
  }
  
  if (!config.pass) {
    console.log('[Email] SMTP密码为空');
    return { success: false, error: 'SMTP密码未配置' };
  }
  
  if (!config.from_email) {
    console.log('[Email] 发件人邮箱为空');
    return { success: false, error: '发件人邮箱未配置' };
  }
  
  try {
    console.log(`[Email] 开始发送邮件: to=${to}, subject=${subject}`);
    
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: Boolean(config.secure),
      auth: {
        user: config.user,
        pass: config.pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    await transporter.verify();
    console.log('[Email] SMTP连接测试成功');
    
    const result = await transporter.sendMail({
      from: config.from_email,
      to,
      subject,
      html: content,
      attachments: attachment ? [{
        path: attachment.filePath,
        filename: attachment.fileName
      }] : []
    });
    
    console.log(`[Email] 邮件发送成功: to=${to}, messageId=${result.messageId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Email] 邮件发送失败 to=${to}:`, error.message);
    return { success: false, error: error.message };
  }
}
