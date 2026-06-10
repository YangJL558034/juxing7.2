import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

interface EmailConfigRow {
  id: number;
  host: string;
  port: number;
  secure: number;
  user: string;
  password?: string | null;
  from_email: string;
  from_name: string;
}

interface EmailConfigPayload {
  host?: string;
  port?: number | string;
  secure?: boolean;
  user?: string;
  password?: string;
  from_email?: string;
  from_name?: string;
}

// 获取邮箱配置
export async function GET() {
  try {
    const config = query.getEmailConfig.get() as EmailConfigRow | undefined;
    
    if (!config) {
      return NextResponse.json({
        host: '',
        port: 465,
        secure: true,
        user: '',
        password: '',
        from_email: '',
        from_name: '聚星数据平台'
      });
    }

    return NextResponse.json({
      host: config.host,
      port: config.port,
      secure: config.secure === 1,
      user: config.user,
      password: '',
      has_password: Boolean(config.password),
      from_email: config.from_email,
      from_name: config.from_name
    });
  } catch (error) {
    console.error('获取邮箱配置失败:', error);
    return NextResponse.json({ error: '获取邮箱配置失败' }, { status: 500 });
  }
}

// 保存邮箱配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as EmailConfigPayload;
    const { host, port, secure, user, password, from_email, from_name } = body;
    const existing = query.getEmailConfig.get() as EmailConfigRow | undefined;
    const passwordToSave = password || existing?.password || '';

    if (!host || !port || !user || !passwordToSave || !from_email) {
      return NextResponse.json({ error: '请填写完整的邮箱配置信息' }, { status: 400 });
    }

    if (existing) {
      // 更新
      query.updateEmailConfig.run(
        host,
        Number(port) || 465,
        secure ? 1 : 0,
        user,
        passwordToSave,
        from_name || '聚星数据平台',
        from_email,
        existing.id
      );
    } else {
      // 新增
      query.createEmailConfig.run(
        host,
        Number(port) || 465,
        secure ? 1 : 0,
        user,
        passwordToSave,
        from_name || '聚星数据平台',
        from_email
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: '邮箱配置保存成功' 
    });
  } catch (error) {
    console.error('保存邮箱配置失败:', error);
    return NextResponse.json({ error: '保存邮箱配置失败' }, { status: 500 });
  }
}
