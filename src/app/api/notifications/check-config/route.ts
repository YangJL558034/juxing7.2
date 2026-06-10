import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET() {
  try {
    // 检查SMTP配置
    const smtpConfig = db.prepare(`
      SELECT id, host, port, secure, user, from_email,
        CASE WHEN pass IS NOT NULL AND pass != '' THEN 1 ELSE 0 END as has_pass
      FROM smtp_config
      ORDER BY id DESC
      LIMIT 1
    `).get();
    
    // 检查用户邮箱
    const usersWithEmail = db.prepare("SELECT id, name, email FROM users WHERE email IS NOT NULL AND email != ''").all();
    const allUsers = db.prepare('SELECT id, name, email FROM users').all();
    
    // 检查管理员
    const admins = db.prepare('SELECT id, name, email FROM users WHERE role = ?').all('admin');
    
    return NextResponse.json({
      success: true,
      smtpConfig: smtpConfig || null,
      hasSmtpConfig: !!smtpConfig,
      usersWithEmail: usersWithEmail.length,
      totalUsers: allUsers.length,
      admins: admins,
      allUsers: allUsers
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '检查邮件配置失败'
    }, { status: 500 });
  }
}
