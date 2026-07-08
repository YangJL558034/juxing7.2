import { NextResponse, type NextRequest } from 'next/server';
import { emitChatMessage } from '@/lib/chat-socket';
import { chatJsonError, requireChatUser } from '@/lib/realtime-chat-api';
import { createTextMessage, listMessages, markConversationRead } from '@/lib/realtime-chat';

export const runtime = 'nodejs';

interface CreateMessageBody {
  conversationId?: number;
  content?: string;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireChatUser(request);
    const searchParams = request.nextUrl.searchParams;
    const conversationId = Number(searchParams.get('conversationId'));
    const limit = Number(searchParams.get('limit') || 30);
    const beforeId = searchParams.get('beforeId');
    const page = listMessages(user, conversationId, {
      limit,
      beforeId: beforeId ? Number(beforeId) : null,
    });

    if (!beforeId) {
      markConversationRead(user, conversationId);
    }

    return NextResponse.json({ success: true, data: page });
  } catch (error) {
    return chatJsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireChatUser(request);
    const body = (await request.json()) as CreateMessageBody;
    const message = createTextMessage(user, Number(body.conversationId), body.content || '');
    emitChatMessage(message);
    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    return chatJsonError(error);
  }
}
