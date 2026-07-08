import { NextResponse, type NextRequest } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/database';

export const runtime = 'nodejs';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function sanitizeBaseName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 80) || 'avatar';
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request.headers.get('cookie'));
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: '请选择头像图片' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json({ success: false, error: '头像图片不能超过 5MB' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase() || '.jpg';
    if (!allowedMimeTypes.has(file.type) && !allowedExtensions.has(ext)) {
      return NextResponse.json({ success: false, error: '仅支持 JPG、PNG、WebP、GIF 头像' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    await mkdir(uploadDir, { recursive: true });

    const safeName = sanitizeBaseName(path.basename(file.name, ext));
    const fileName = `avatar_${user.id}_${Date.now()}_${safeName}${ext}`;
    const storagePath = path.join(uploadDir, fileName);
    await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));

    const avatarUrl = `/uploads/avatars/${fileName}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, user.id);

    return NextResponse.json({ success: true, data: { avatar: avatarUrl } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '头像上传失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
