import { NextResponse, type NextRequest } from 'next/server';
import { chatJsonError, requireChatUser } from '@/lib/realtime-chat-api';
import { getUnreadTotal } from '@/lib/realtime-chat';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireChatUser(request);
    return NextResponse.json({ success: true, data: { unreadCount: getUnreadTotal(user) } });
  } catch (error) {
    return chatJsonError(error);
  }
}
