import type { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { getCurrentUser, type User } from './auth';
import {
  ChatError,
  createTextMessage,
  getConversationForUser,
  isConversationMember,
  listConversations,
  recallMessage,
} from './realtime-chat';
import type { ChatConversation, ChatMessage } from '@/types/realtime-chat';

type ChatSocketServer = SocketServer;

interface SendPayload {
  conversationId?: number;
  content?: string;
}

interface RecallPayload {
  messageId?: number;
}

interface SocketCallbackPayload {
  success: boolean;
  error?: string;
  message?: ChatMessage;
}

const globalSocketState = globalThis as unknown as {
  __realtimeChatIo?: ChatSocketServer;
};

function conversationRoom(conversationId: number) {
  return `chat:conversation:${conversationId}`;
}

function userRoom(userId: number) {
  return `chat:user:${userId}`;
}

function socketErrorPayload(error: unknown) {
  if (error instanceof ChatError) {
    return { success: false, error: error.message };
  }
  if (error instanceof Error) {
    return { success: false, error: error.message };
  }
  return { success: false, error: '操作失败' };
}

function assertNumber(value: unknown, field: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new ChatError(`${field} 参数无效`);
  }
  return numberValue;
}

function socketUser(socket: { data: { user?: User } }) {
  const user = socket.data.user;
  if (!user) {
    throw new ChatError('登录已失效', 401);
  }
  return user;
}

async function joinAccessibleRooms(socket: { join: (room: string) => void; data: { user?: User } }) {
  const user = socketUser(socket);
  socket.join(userRoom(user.id));
  listConversations(user).forEach((conversation) => {
    socket.join(conversationRoom(conversation.id));
  });
}

export function getChatSocketServer() {
  return globalSocketState.__realtimeChatIo || null;
}

export function emitChatMessage(message: ChatMessage) {
  const io = getChatSocketServer();
  if (!io) return;
  io.to(conversationRoom(message.conversation_id)).emit('chat:message', message);
}

export function emitChatRecall(message: ChatMessage) {
  const io = getChatSocketServer();
  if (!io) return;
  io.to(conversationRoom(message.conversation_id)).emit('chat:message-recalled', message);
}

export function emitConversationUpdated(conversation: ChatConversation) {
  const io = getChatSocketServer();
  if (!io) return;
  conversation.members.forEach((member) => {
    const personalized = getConversationForUser(conversation.id, {
      id: member.user_id,
      username: member.username,
      name: member.name,
      avatar: member.avatar || undefined,
      role: 'user',
    });
    io.to(userRoom(member.user_id)).emit('chat:conversation-updated', personalized || conversation);
  });
}

export function emitConversationRemoved(userId: number, conversationId: number, reason?: string) {
  const io = getChatSocketServer();
  if (!io) return;
  io.to(userRoom(userId)).emit('chat:conversation-removed', { conversationId, reason });
}

export function refreshConversationSockets(conversationId: number) {
  const io = getChatSocketServer();
  if (!io) return;

  for (const socket of io.sockets.sockets.values()) {
    const user = socket.data.user as User | undefined;
    if (!user) continue;
    const canJoin = isConversationMember(conversationId, user.id);
    if (canJoin) {
      socket.join(conversationRoom(conversationId));
    } else {
      socket.leave(conversationRoom(conversationId));
    }
  }
}

export function setupChatSocket(server: HttpServer) {
  if (globalSocketState.__realtimeChatIo) {
    return globalSocketState.__realtimeChatIo;
  }

  const io = new SocketServer(server, {
    path: '/socket.io',
    cors: {
      origin: true,
      credentials: true,
    },
    maxHttpBufferSize: 1024 * 1024,
  });

  io.use(async (socket, next) => {
    try {
      const user = await getCurrentUser(socket.handshake.headers.cookie || null);
      if (!user) {
        next(new Error('未登录'));
        return;
      }
      socket.data.user = user;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error('登录校验失败'));
    }
  });

  io.on('connection', (socket) => {
    void joinAccessibleRooms(socket);

    socket.on('chat:join', (payload: { conversationId?: number }, callback?: (payload: SocketCallbackPayload) => void) => {
      try {
        const user = socketUser(socket);
        const conversationId = assertNumber(payload?.conversationId, 'conversationId');
        const conversation = getConversationForUser(conversationId, user);
        if (!conversation) {
          throw new ChatError('您还没有加入该群聊', 403);
        }
        socket.join(conversationRoom(conversationId));
        callback?.({ success: true });
      } catch (error) {
        callback?.(socketErrorPayload(error));
      }
    });

    socket.on('chat:send', (payload: SendPayload, callback?: (payload: SocketCallbackPayload) => void) => {
      try {
        const user = socketUser(socket);
        const conversationId = assertNumber(payload?.conversationId, 'conversationId');
        const message = createTextMessage(user, conversationId, payload?.content || '');
        emitChatMessage(message);
        callback?.({ success: true, message });
      } catch (error) {
        callback?.(socketErrorPayload(error));
      }
    });

    socket.on('chat:recall', (payload: RecallPayload, callback?: (payload: SocketCallbackPayload) => void) => {
      try {
        const user = socketUser(socket);
        const messageId = assertNumber(payload?.messageId, 'messageId');
        const message = recallMessage(user, messageId);
        emitChatRecall(message);
        callback?.({ success: true, message });
      } catch (error) {
        callback?.(socketErrorPayload(error));
      }
    });
  });

  globalSocketState.__realtimeChatIo = io;
  return io;
}
