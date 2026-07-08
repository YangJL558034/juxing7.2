import { NextResponse, type NextRequest } from 'next/server';
import { emitChatMessage } from '@/lib/chat-socket';
import { chatJsonError, requireChatUser } from '@/lib/realtime-chat-api';
import { createFileMessage } from '@/lib/realtime-chat';
import { storeCompressedChatFile } from '@/lib/realtime-chat-files';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await requireChatUser(request);
    const formData = await request.formData();
    const conversationId = Number(formData.get('conversationId'));
    const contentValue = formData.get('content');
    const fileValue = formData.get('file');

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ success: false, error: '请选择要上传的文件' }, { status: 400 });
    }

    const storedFile = await storeCompressedChatFile(fileValue);
    const message = createFileMessage(
      user,
      conversationId,
      storedFile,
      typeof contentValue === 'string' ? contentValue : undefined,
    );
    emitChatMessage(message);
    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    return chatJsonError(error);
  }
}
