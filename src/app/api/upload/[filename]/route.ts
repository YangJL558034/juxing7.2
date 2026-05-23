import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // 从 public/uploads/notifications/ 目录读取文件
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'notifications', filename);
    
    console.log(`[Download API] 尝试读取文件: ${filePath}`);
    
    if (!existsSync(filePath)) {
      console.log(`[Download API] 文件不存在: ${filePath}`);
      return NextResponse.json({ error: '文件不存在' }, { status: 404 });
    }
    
    const fileBuffer = await readFile(filePath);
    
    // 根据文件扩展名设置 Content-Type
    const ext = path.extname(filename).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };
    
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    console.log(`[Download API] 文件读取成功，Content-Type: ${contentType}`);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json({ error: '读取文件失败' }, { status: 500 });
  }
}
