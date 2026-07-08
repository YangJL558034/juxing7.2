import { NextResponse, type NextRequest } from 'next/server';
import { chatJsonError, requireChatUser } from '@/lib/realtime-chat-api';
import { listChatUsers } from '@/lib/realtime-chat';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireChatUser(request);
    return NextResponse.json({ success: true, data: listChatUsers() });
  } catch (error) {
    return chatJsonError(error);
  }
}
