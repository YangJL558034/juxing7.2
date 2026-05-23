import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    console.log('[Upload API] 收到文件上传请求');
    
    // 优先从 Authorization header 获取 token
    let token = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    // 如果没有，尝试从 cookie 获取
    if (!token) {
      token = request.cookies.get('auth_token')?.value;
      console.log('[Upload API] 从cookie获取token:', !!token);
    }
    
    if (!token) {
      console.log('[Upload API] 未授权访问 - 缺少 token');
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { verifyToken } = await import('@/lib/auth');
    const decoded = await verifyToken(token);
    if (!decoded) {
      console.log('[Upload API] 未授权访问 - token 无效');
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      console.log('[Upload API] 没有上传文件');
      return NextResponse.json({ error: '没有上传文件' }, { status: 400 });
    }

    console.log(`[Upload API] 文件名: ${file.name}, 大小: ${file.size}, 类型: ${file.type}`);

    // 检查文件类型（支持图片、PDF和Excel文件）
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    // 检查文件扩展名（因为Excel文件类型可能不同）
    const ext = path.extname(file.name).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.xlsx', '.xls'];
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(ext)) {
      console.log(`[Upload API] 不支持的文件类型: ${file.type}, 扩展名: ${ext}`);
      return NextResponse.json({ error: '不支持的文件类型，仅支持 JPG、PNG、GIF、WebP、PDF 和 Excel' }, { status: 400 });
    }

    // 检查文件大小（限制为 50MB）
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      console.log(`[Upload API] 文件大小超过限制: ${file.size} > ${maxSize}`);
      return NextResponse.json({ error: '文件大小不能超过 50MB' }, { status: 400 });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `upload_${timestamp}_${randomStr}${ext}`;

    // 确保上传目录存在（使用通用上传目录）
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    console.log(`[Upload API] 上传目录: ${uploadDir}`);
    
    if (!existsSync(uploadDir)) {
      console.log(`[Upload API] 创建上传目录: ${uploadDir}`);
      await mkdir(uploadDir, { recursive: true });
    }

    // 保存文件
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);
    
    console.log(`[Upload API] 文件保存成功: ${filePath}`);

    // 返回文件路径（相对于 public 目录和绝对路径）
    const fileUrl = `/uploads/${fileName}`;

    console.log(`[Upload API] 返回文件URL: ${fileUrl}, 路径: ${filePath}`);
    
    return NextResponse.json({
      success: true,
      url: fileUrl, // 保持向后兼容
      fileUrl,
      filePath, // 绝对路径，用于API读取
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
  } catch (error: any) {
    console.error('[Upload API] 文件上传失败:', error.message || error);
    return NextResponse.json({ error: '文件上传失败: ' + (error.message || error) }, { status: 500 });
  }
}
