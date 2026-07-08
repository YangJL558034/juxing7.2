import { NextResponse, type NextRequest } from 'next/server';
import { emitConversationUpdated, refreshConversationSockets } from '@/lib/chat-socket';
import { chatJsonError, requireChatUser } from '@/lib/realtime-chat-api';
import { createConversation, createDirectConversation, listConversations } from '@/lib/realtime-chat';
import type { ChatConversationType } from '@/types/realtime-chat';

export const runtime = 'nodejs';

interface CreateConversationBody {
  title?: string;
  type?: ChatConversationType;
  memberIds?: number[];
  targetUserId?: number;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireChatUser(request);
    return NextResponse.json({ success: true, data: listConversations(user) });
  } catch (error) {
    return chatJsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireChatUser(request);
    const body = (await request.json()) as CreateConversationBody;
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds : [];
    const conversation = body.type === 'direct'
      ? createDirectConversation(Number(body.targetUserId || memberIds[0]), user)
      : createConversation(body.title || '', memberIds, user);
    refreshConversationSockets(conversation.id);
    emitConversationUpdated(conversation);
    return NextResponse.json({ success: true, data: conversation });
  } catch (error) {
    return chatJsonError(error);
  }
}
