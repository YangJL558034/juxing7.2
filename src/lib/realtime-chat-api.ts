import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser, type User } from './auth';
import { ChatError } from './realtime-chat';

export async function requireChatUser(request: NextRequest): Promise<User> {
  const user = await getCurrentUser(request.headers.get('cookie'));
  if (!user) {
    throw new ChatError('请先登录', 401);
  }
  return user;
}

export function chatJsonError(error: unknown) {
  if (error instanceof ChatError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }

  console.error('Realtime chat API error:', error);
  const message = error instanceof Error ? error.message : '操作失败';
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}
