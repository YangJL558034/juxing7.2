import { NextResponse, type NextRequest } from 'next/server';
import {
  emitChatMessage,
  emitConversationRemoved,
  emitConversationUpdated,
  refreshConversationSockets,
} from '@/lib/chat-socket';
import { chatJsonError, requireChatUser } from '@/lib/realtime-chat-api';
import {
  assertConversationAccess,
  createSystemMessage,
  dissolveConversation,
  getConversationForUser,
  leaveConversation,
  listConversationMembers,
  updateConversationTitle,
} from '@/lib/realtime-chat';

export const runtime = 'nodejs';

interface ConversationBody {
  title?: string;
  action?: 'leave' | 'dissolve';
}

type RouteContext = { params: Promise<{ id: string }> };

async function conversationIdFrom(context: RouteContext) {
  const { id } = await context.params;
  return Number(id);
}

function displayName(value?: { name?: string | null; username?: string | null }) {
  return value?.name || value?.username || '成员';
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireChatUser(request);
    const conversationId = await conversationIdFrom(context);
    const conversation = assertConversationAccess(conversationId, user);
    return NextResponse.json({ success: true, data: conversation });
  } catch (error) {
    return chatJsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireChatUser(request);
    const conversationId = await conversationIdFrom(context);
    const body = (await request.json()) as ConversationBody;
    const conversation = updateConversationTitle(conversationId, body.title || '', user);
    refreshConversationSockets(conversationId);
    emitChatMessage(createSystemMessage(user, conversationId, `${displayName(user)} 将群聊名称修改为 ${conversation.title}`));
    emitConversationUpdated(conversation);
    return NextResponse.json({ success: true, data: conversation });
  } catch (error) {
    return chatJsonError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireChatUser(request);
    const conversationId = await conversationIdFrom(context);
    const body = (await request.json().catch(() => ({}))) as ConversationBody;
    const currentConversation = assertConversationAccess(conversationId, user);

    if (body.action === 'dissolve') {
      const memberIds = currentConversation.members.map((member) => member.user_id);
      dissolveConversation(conversationId, user);
      memberIds.forEach((memberId) =>
        emitConversationRemoved(memberId, conversationId, `群聊已被 ${displayName(user)} 解散`),
      );
      refreshConversationSockets(conversationId);
      return NextResponse.json({ success: true, data: { conversationId, action: 'dissolve' } });
    }

    const leaveMessage = createSystemMessage(user, conversationId, `${displayName(user)} 退出群聊`);
    leaveConversation(conversationId, user);
    emitConversationRemoved(user.id, conversationId, '你已退出群聊');
    refreshConversationSockets(conversationId);
    emitChatMessage(leaveMessage);

    const remainingMembers = listConversationMembers(conversationId);
    const fallbackMember = remainingMembers[0];
    if (fallbackMember) {
      const updated = getConversationForUser(conversationId, {
        id: fallbackMember.user_id,
        username: fallbackMember.username,
        name: fallbackMember.name,
        avatar: fallbackMember.avatar || undefined,
        role: 'user',
      });
      if (updated) {
        emitConversationUpdated(updated);
      }
    }

    return NextResponse.json({ success: true, data: { conversationId, action: 'leave' } });
  } catch (error) {
    return chatJsonError(error);
  }
}
