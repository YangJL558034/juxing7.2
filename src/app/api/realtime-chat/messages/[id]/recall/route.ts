import { NextResponse, type NextRequest } from 'next/server';
import { emitChatRecall } from '@/lib/chat-socket';
import { chatJsonError, requireChatUser } from '@/lib/realtime-chat-api';
import { recallMessage } from '@/lib/realtime-chat';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireChatUser(request);
    const { id } = await context.params;
    const message = recallMessage(user, Number(id));
    emitChatRecall(message);
    return NextResponse.json({ success: true, data: message });
  } catch (error) {
    return chatJsonError(error);
  }
}
