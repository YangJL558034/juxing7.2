import fs from 'fs/promises';
import path from 'path';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import type { StoredChatFile } from './realtime-chat';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const MAX_CHAT_FILE_SIZE = Number(process.env.CHAT_MAX_FILE_SIZE || 20 * 1024 * 1024);
const IMAGE_MIME_PREFIX = 'image/';

function chatUploadDir() {
  return process.env.CHAT_UPLOAD_DIR || path.join(process.cwd(), 'data', 'chat-uploads');
}

function sanitizeFileName(name: string) {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'file';
}

function randomToken() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function storeCompressedChatFile(file: File): Promise<StoredChatFile> {
  if (file.size <= 0) {
    throw new Error('文件不能为空');
  }
  if (file.size > MAX_CHAT_FILE_SIZE) {
    throw new Error(`文件不能超过 ${Math.round(MAX_CHAT_FILE_SIZE / 1024 / 1024)}MB`);
  }

  const originalName = sanitizeFileName(file.name || 'file');
  const ext = path.extname(originalName).slice(0, 20) || null;
  const baseName = path.basename(originalName, ext || undefined).slice(0, 80) || 'file';
  const storedName = `${randomToken()}_${baseName}${ext || ''}.gz`;
  const dir = chatUploadDir();
  await fs.mkdir(dir, { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());
  const compressed = await gzipAsync(bytes, { level: 9 });
  const storagePath = path.join(dir, storedName);
  await fs.writeFile(storagePath, compressed);

  return {
    fileName: storedName,
    originalName,
    mimeType: file.type || 'application/octet-stream',
    fileExt: ext,
    size: bytes.length,
    compressedSize: compressed.length,
    storagePath,
    isImage: (file.type || '').startsWith(IMAGE_MIME_PREFIX),
  };
}

export async function readCompressedChatFile(storagePath: string) {
  const compressed = await fs.readFile(storagePath);
  return gunzipAsync(compressed);
}
