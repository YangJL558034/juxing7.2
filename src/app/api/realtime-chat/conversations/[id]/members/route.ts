import { NextResponse, type NextRequest } from 'next/server';
import {
  emitChatMessage,
  emitConversationRemoved,
  emitConversationUpdated,
  refreshConversationSockets,
} from '@/lib/chat-socket';
import { chatJsonError, requireChatUser } from '@/lib/realtime-chat-api';
import {
  addConversationMembers,
  assertConversationAccess,
  createSystemMessage,
  listConversationMembers,
  removeConversationMember,
  updateMemberSettings,
} from '@/lib/realtime-chat';

export const runtime = 'nodejs';

interface MembersBody {
  memberIds?: number[];
  memberId?: number;
  targetUserId?: number;
  doNotDisturb?: boolean;
  mutedUntil?: string | null;
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
    assertConversationAccess(conversationId, user);
    return NextResponse.json({ success: true, data: listConversationMembers(conversationId) });
  } catch (error) {
    return chatJsonError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireChatUser(request);
    const conversationId = await conversationIdFrom(context);
    const body = (await request.json()) as MembersBody;
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds : [];
    const conversation = addConversationMembers(conversationId, memberIds, user);
    refreshConversationSockets(conversationId);
    const addedNames = conversation.members
      .filter((member) => memberIds.map(Number).includes(member.user_id))
      .map(displayName);

    if (addedNames.length > 0) {
      emitChatMessage(createSystemMessage(user, conversationId, `${displayName(user)} 邀请 ${addedNames.join('、')} 加入群聊`));
    }
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
    const body = (await request.json()) as MembersBody;
    const memberId = Number(body.memberId);
    const beforeMembers = listConversationMembers(conversationId);
    const removedMember = beforeMembers.find((member) => member.user_id === memberId);
    const conversation = removeConversationMember(conversationId, memberId, user);
    const removedName = displayName(removedMember);
    emitConversationRemoved(memberId, conversationId, `你已被 ${displayName(user)} 移出群聊`);
    refreshConversationSockets(conversationId);
    emitChatMessage(createSystemMessage(user, conversationId, `${displayName(user)} 将 ${removedName} 移出群聊`));
    emitConversationUpdated(conversation);
    return NextResponse.json({ success: true, data: conversation });
  } catch (error) {
    return chatJsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireChatUser(request);
    const conversationId = await conversationIdFrom(context);
    const body = (await request.json()) as MembersBody;
    const targetUserId = Number(body.targetUserId || body.memberId || user.id);
    const beforeMembers = listConversationMembers(conversationId);
    const targetMember = beforeMembers.find((member) => member.user_id === targetUserId);
    const conversation = updateMemberSettings(
      conversationId,
      targetUserId,
      {
        doNotDisturb: typeof body.doNotDisturb === 'boolean' ? body.doNotDisturb : undefined,
        mutedUntil: body.mutedUntil,
      },
      user,
    );

    refreshConversationSockets(conversationId);
    if (body.mutedUntil !== undefined && targetMember) {
      const targetName = displayName(targetMember);
      const content = body.mutedUntil
        ? `${displayName(user)} 将 ${targetName} 禁言至 ${body.mutedUntil}`
        : `${displayName(user)} 取消了 ${targetName} 的禁言`;
      emitChatMessage(createSystemMessage(user, conversationId, content));
    }
    emitConversationUpdated(conversation);
    return NextResponse.json({ success: true, data: conversation });
  } catch (error) {
    return chatJsonError(error);
  }
}
