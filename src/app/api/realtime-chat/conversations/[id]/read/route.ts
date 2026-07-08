import { NextResponse, type NextRequest } from 'next/server';
import { chatJsonError, requireChatUser } from '@/lib/realtime-chat-api';
import { markConversationRead } from '@/lib/realtime-chat';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireChatUser(request);
    const { id } = await context.params;
    markConversationRead(user, Number(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return chatJsonError(error);
  }
}
