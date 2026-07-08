import { NextResponse, type NextRequest } from 'next/server';
import { chatJsonError, requireChatUser } from '@/lib/realtime-chat-api';
import { getAttachmentForAccess } from '@/lib/realtime-chat';
import { readCompressedChatFile } from '@/lib/realtime-chat-files';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

function contentDisposition(fileName: string, inline: boolean) {
  const encoded = encodeURIComponent(fileName);
  return `${inline ? 'inline' : 'attachment'}; filename="download"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireChatUser(request);
    const { id } = await context.params;
    const attachment = getAttachmentForAccess(user, Number(id));
    const bytes = await readCompressedChatFile(attachment.storage_path);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': attachment.mime_type || 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Content-Disposition': contentDisposition(attachment.original_name, attachment.is_image === 1),
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    return chatJsonError(error);
  }
}
