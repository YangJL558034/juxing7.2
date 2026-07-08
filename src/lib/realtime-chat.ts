import { db } from './database';
import { chinaNowSql, parseChinaTime } from './china-time';
import type { User } from './auth';
import type {
  ChatAttachment,
  ChatConversation,
  ChatConversationType,
  ChatMember,
  ChatMessage,
  ChatMessagePage,
  ChatMessageType,
  ChatUserOption,
} from '@/types/realtime-chat';

export const CHAT_RECALL_WINDOW_SECONDS = Number(process.env.CHAT_RECALL_WINDOW_SECONDS || 120);

export class ChatError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ChatError';
    this.status = status;
  }
}

interface ChatConversationRow {
  id: number;
  title: string;
  type: ChatConversationType;
  created_by: number;
  created_at: string;
  updated_at: string;
  member_count: number | null;
  unread_count: number | null;
  last_message_at: string | null;
  last_message_preview: string | null;
}

interface ChatMessageRow {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  message_type: ChatMessageType;
  content: string | null;
  recalled: 0 | 1;
  recalled_at: string | null;
  recalled_by: number | null;
  created_at: string;
  updated_at: string | null;
}

interface ChatAttachmentRow {
  id: number;
  message_id: number;
  conversation_id: number;
  file_name: string;
  original_name: string;
  mime_type: string;
  file_ext: string | null;
  size: number;
  compressed_size: number;
  storage_path: string;
  is_image: 0 | 1;
  created_at: string;
}

interface MemberRow {
  id: number;
  conversation_id: number;
  user_id: number;
  username: string;
  name: string;
  avatar: string | null;
  role: 'owner' | 'member';
  muted_until: string | null;
  do_not_disturb: 0 | 1;
  created_at: string;
}

interface MemberAccessRow {
  role: 'owner' | 'member';
  muted_until: string | null;
  do_not_disturb: 0 | 1;
}

export interface StoredChatFile {
  fileName: string;
  originalName: string;
  mimeType: string;
  fileExt: string | null;
  size: number;
  compressedSize: number;
  storagePath: string;
  isImage: boolean;
}

export interface ChatAttachmentAccess extends ChatAttachmentRow {
  message_recalled: 0 | 1;
}

function attachmentUrl(id: number) {
  return `/api/realtime-chat/files/${id}`;
}

function messagePreviewSql() {
  return `
    CASE
      WHEN lm.recalled = 1 THEN '[消息已撤回]'
      WHEN lm.message_type = 'text' THEN COALESCE(lm.content, '')
      WHEN lm.message_type = 'system' THEN COALESCE(lm.content, '')
      WHEN lm.message_type = 'image' THEN '[图片]'
      WHEN lm.message_type = 'file' THEN '[文件]'
      ELSE NULL
    END
  `;
}

function normalizeAttachment(row: ChatAttachmentRow): ChatAttachment {
  return {
    id: row.id,
    message_id: row.message_id,
    conversation_id: row.conversation_id,
    file_name: row.file_name,
    original_name: row.original_name,
    mime_type: row.mime_type,
    file_ext: row.file_ext,
    size: row.size,
    compressed_size: row.compressed_size,
    is_image: row.is_image,
    created_at: row.created_at,
    url: attachmentUrl(row.id),
  };
}

function normalizeMessage(row: ChatMessageRow, attachments: ChatAttachment[] = []): ChatMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    sender_name: row.sender_name,
    message_type: row.message_type,
    content: row.content,
    recalled: row.recalled,
    recalled_at: row.recalled_at,
    recalled_by: row.recalled_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    attachments,
  };
}

function normalizeMember(row: MemberRow): ChatMember {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    user_id: row.user_id,
    username: row.username,
    name: row.name,
    avatar: row.avatar,
    role: row.role,
    muted_until: row.muted_until,
    do_not_disturb: row.do_not_disturb,
    created_at: row.created_at,
  };
}

function normalizeConversation(
  row: ChatConversationRow,
  members: ChatMember[] = [],
  viewer?: Pick<User, 'id'>,
): ChatConversation {
  const otherMember =
    row.type === 'direct' ? members.find((member) => member.user_id !== viewer?.id) || members[0] : undefined;

  return {
    id: row.id,
    title: row.type === 'direct' ? otherMember?.name || row.title || '私信' : row.title,
    type: row.type,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    member_count: Number(row.member_count || 0),
    unread_count: Number(row.unread_count || 0),
    avatar: row.type === 'direct' ? otherMember?.avatar || null : null,
    last_message_at: row.last_message_at,
    last_message_preview: row.last_message_preview,
    members,
  };
}

function parseNumberId(value: unknown, message = '参数无效') {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new ChatError(message);
  }
  return numberValue;
}

function nowTime() {
  return Date.now();
}

function getMemberAccess(conversationId: number, userId: number): MemberAccessRow | null {
  const row = db
    .prepare(`
      SELECT role, muted_until, do_not_disturb
      FROM im_conversation_members
      WHERE conversation_id = ? AND user_id = ?
      LIMIT 1
    `)
    .get(conversationId, userId) as MemberAccessRow | undefined;

  return row || null;
}

function assertMembership(conversationId: number, userId: number) {
  const membership = getMemberAccess(conversationId, userId);
  if (!membership) {
    throw new ChatError('您还没有加入该会话', 403);
  }
  return membership;
}

function isMuted(member: Pick<ChatMember, 'muted_until'> | MemberAccessRow | null) {
  if (!member?.muted_until) return false;
  const mutedUntil = parseChinaTime(member.muted_until)?.getTime();
  return typeof mutedUntil === 'number' && mutedUntil > nowTime();
}

function requireGroupConversation(conversation: ChatConversation) {
  if (conversation.type !== 'group') {
    throw new ChatError('该操作仅支持群聊');
  }
}

function canManageConversation(conversation: ChatConversation, user: User) {
  return (
    isChatAdmin(user) ||
    conversation.created_by === user.id ||
    conversation.members.some((member) => member.user_id === user.id && member.role === 'owner')
  );
}

function assertManageConversation(conversation: ChatConversation, user: User) {
  if (!canManageConversation(conversation, user)) {
    throw new ChatError('只有群主或管理员可以执行该操作', 403);
  }
}

function attachmentsForMessages(messageIds: number[]) {
  if (messageIds.length === 0) return new Map<number, ChatAttachment[]>();
  const placeholders = messageIds.map(() => '?').join(',');
  const rows = db
    .prepare(`
      SELECT * FROM im_attachments
      WHERE message_id IN (${placeholders})
      ORDER BY id ASC
    `)
    .all(...messageIds) as ChatAttachmentRow[];

  const grouped = new Map<number, ChatAttachment[]>();
  rows.forEach((row) => {
    const current = grouped.get(row.message_id) || [];
    current.push(normalizeAttachment(row));
    grouped.set(row.message_id, current);
  });
  return grouped;
}

function latestMessageId(conversationId: number) {
  const row = db
    .prepare(`
      SELECT COALESCE(MAX(id), 0) as id
      FROM im_messages
      WHERE conversation_id = ?
    `)
    .get(conversationId) as { id: number } | undefined;

  return Number(row?.id || 0);
}

function markConversationReadById(conversationId: number, userId: number, updatedAt = chinaNowSql()) {
  const lastReadMessageId = latestMessageId(conversationId);
  db.prepare(`
    INSERT INTO im_conversation_reads (conversation_id, user_id, last_read_message_id, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(conversation_id, user_id)
    DO UPDATE SET last_read_message_id = excluded.last_read_message_id, updated_at = excluded.updated_at
  `).run(conversationId, userId, lastReadMessageId, updatedAt);
}

function messageAccessRow(messageId: number) {
  return db
    .prepare(`
      SELECT *
      FROM im_messages
      WHERE id = ?
      LIMIT 1
    `)
    .get(messageId) as ChatMessageRow | undefined;
}

export function isChatAdmin(user: Pick<User, 'role'> | null | undefined) {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

export function listChatUsers(): ChatUserOption[] {
  return db
    .prepare(`
      SELECT
        u.id,
        u.username,
        u.name,
        u.avatar,
        u.role,
        COALESCE(d.name, d_text.name, u.department) as department
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN departments d_text ON CAST(d_text.id AS TEXT) = u.department
      WHERE COALESCE(u.status, 'active') <> 'deleted'
      ORDER BY u.name COLLATE NOCASE ASC, u.username COLLATE NOCASE ASC
    `)
    .all() as ChatUserOption[];
}

export function listConversationMembers(conversationId: number): ChatMember[] {
  const rows = db
    .prepare(`
      SELECT
        m.id,
        m.conversation_id,
        m.user_id,
        u.username,
        u.name,
        u.avatar,
        m.role,
        m.muted_until,
        m.do_not_disturb,
        m.created_at
      FROM im_conversation_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.conversation_id = ?
      ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, u.name COLLATE NOCASE ASC
    `)
    .all(conversationId) as MemberRow[];

  return rows.map(normalizeMember);
}

export function isConversationMember(conversationId: number, userId: number) {
  return Boolean(getMemberAccess(conversationId, userId));
}

function conversationSelectSql() {
  return `
    SELECT
      c.*,
      COUNT(DISTINCT m.user_id) as member_count,
      lm.created_at as last_message_at,
      ${messagePreviewSql()} as last_message_preview,
      COALESCE((
        SELECT COUNT(*)
        FROM im_messages unread
        WHERE unread.conversation_id = c.id
          AND unread.sender_id <> ?
          AND unread.id > COALESCE((
            SELECT r.last_read_message_id
            FROM im_conversation_reads r
            WHERE r.conversation_id = c.id AND r.user_id = ?
          ), 0)
      ), 0) as unread_count
    FROM im_conversations c
    LEFT JOIN im_conversation_members m ON m.conversation_id = c.id
    LEFT JOIN im_messages lm ON lm.id = (
      SELECT id
      FROM im_messages
      WHERE conversation_id = c.id
      ORDER BY id DESC
      LIMIT 1
    )
  `;
}

export function getConversationForUser(conversationId: number, user: User): ChatConversation | null {
  const row = db
    .prepare(`
      ${conversationSelectSql()}
      WHERE c.id = ?
        AND c.deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM im_conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = ?
        )
      GROUP BY c.id
    `)
    .get(user.id, user.id, conversationId, user.id) as ChatConversationRow | undefined;

  return row ? normalizeConversation(row, listConversationMembers(row.id), user) : null;
}

export function assertConversationAccess(conversationId: number, user: User) {
  const conversation = getConversationForUser(conversationId, user);
  if (!conversation) {
    throw new ChatError('您还没有加入该会话', 403);
  }
  return conversation;
}

export function listConversations(user: User): ChatConversation[] {
  const rows = db
    .prepare(`
      ${conversationSelectSql()}
      WHERE c.deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM im_conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = ?
        )
      GROUP BY c.id
      ORDER BY COALESCE(lm.created_at, c.updated_at, c.created_at) DESC, c.id DESC
    `)
    .all(user.id, user.id, user.id) as ChatConversationRow[];

  return rows.map((row) => normalizeConversation(row, listConversationMembers(row.id), user));
}

function getUserExists(userId: number) {
  return db
    .prepare(`
      SELECT id
      FROM users
      WHERE id = ? AND COALESCE(status, 'active') <> 'deleted'
    `)
    .get(userId) as { id: number } | undefined;
}

function uniqueMemberIds(memberIds: number[], currentUserId: number) {
  return Array.from(new Set([currentUserId, ...memberIds.map(Number).filter((id) => id > 0)]));
}

export function createConversation(title: string, memberIds: number[], user: User): ChatConversation {
  const cleanTitle = title.trim() || `${user.name || user.username}的群聊`;
  const uniqueIds = uniqueMemberIds(memberIds, user.id);
  const now = chinaNowSql();

  const conversationId = db.transaction(() => {
    const result = db
      .prepare(`
        INSERT INTO im_conversations (title, type, created_by, created_at, updated_at)
        VALUES (?, 'group', ?, ?, ?)
      `)
      .run(cleanTitle, user.id, now, now);

    const id = Number(result.lastInsertRowid);
    const insertMember = db.prepare(`
      INSERT OR IGNORE INTO im_conversation_members
        (conversation_id, user_id, role, added_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    uniqueIds.forEach((memberId) => {
      if (getUserExists(memberId)) {
        insertMember.run(id, memberId, memberId === user.id ? 'owner' : 'member', user.id, now);
      }
    });

    markConversationReadById(id, user.id, now);
    return id;
  })();

  const conversation = getConversationForUser(conversationId, user);
  if (!conversation) {
    throw new ChatError('群聊创建失败', 500);
  }
  return conversation;
}

function findDirectConversation(userA: number, userB: number): number | null {
  const first = Math.min(userA, userB);
  const second = Math.max(userA, userB);
  const row = db
    .prepare(`
      SELECT c.id
      FROM im_conversations c
      JOIN im_conversation_members m ON m.conversation_id = c.id
      WHERE c.type = 'direct'
        AND c.deleted_at IS NULL
        AND m.user_id IN (?, ?)
      GROUP BY c.id
      HAVING COUNT(DISTINCT m.user_id) = 2
        AND SUM(DISTINCT m.user_id) = ?
      LIMIT 1
    `)
    .get(first, second, first + second) as { id: number } | undefined;

  return row?.id || null;
}

export function createDirectConversation(targetUserId: number, user: User): ChatConversation {
  const targetId = parseNumberId(targetUserId, '请选择要私信的用户');
  if (targetId === user.id) {
    throw new ChatError('不能给自己发起私信');
  }
  if (!getUserExists(targetId)) {
    throw new ChatError('用户不存在或已停用', 404);
  }

  const existingId = findDirectConversation(user.id, targetId);
  if (existingId) {
    const existing = getConversationForUser(existingId, user);
    if (existing) return existing;
  }

  const now = chinaNowSql();
  const conversationId = db.transaction(() => {
    const result = db
      .prepare(`
        INSERT INTO im_conversations (title, type, created_by, created_at, updated_at)
        VALUES ('私信', 'direct', ?, ?, ?)
      `)
      .run(user.id, now, now);

    const id = Number(result.lastInsertRowid);
    const insertMember = db.prepare(`
      INSERT INTO im_conversation_members
        (conversation_id, user_id, role, added_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertMember.run(id, user.id, 'owner', user.id, now);
    insertMember.run(id, targetId, 'member', user.id, now);
    markConversationReadById(id, user.id, now);
    return id;
  })();

  const conversation = getConversationForUser(conversationId, user);
  if (!conversation) {
    throw new ChatError('私信创建失败', 500);
  }
  return conversation;
}

export function addConversationMembers(conversationId: number, memberIds: number[], user: User): ChatConversation {
  const conversation = assertConversationAccess(conversationId, user);
  requireGroupConversation(conversation);
  assertManageConversation(conversation, user);

  const uniqueIds = Array.from(new Set(memberIds.map(Number).filter((id) => id > 0)));
  const now = chinaNowSql();
  const insertMember = db.prepare(`
    INSERT OR IGNORE INTO im_conversation_members
      (conversation_id, user_id, role, added_by, created_at)
    VALUES (?, ?, 'member', ?, ?)
  `);

  db.transaction(() => {
    uniqueIds.forEach((memberId) => {
      if (getUserExists(memberId)) {
        insertMember.run(conversationId, memberId, user.id, now);
      }
    });
    db.prepare('UPDATE im_conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);
  })();

  const updated = getConversationForUser(conversationId, user);
  if (!updated) {
    throw new ChatError('群聊不存在', 404);
  }
  return updated;
}

export function removeConversationMember(conversationId: number, memberId: number, user: User): ChatConversation {
  const conversation = assertConversationAccess(conversationId, user);
  requireGroupConversation(conversation);
  assertManageConversation(conversation, user);

  if (conversation.created_by === memberId) {
    throw new ChatError('不能移除群主');
  }

  const now = chinaNowSql();
  db.transaction(() => {
    db.prepare(`
      DELETE FROM im_conversation_members
      WHERE conversation_id = ? AND user_id = ? AND role <> 'owner'
    `).run(conversationId, memberId);
    db.prepare('UPDATE im_conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);
  })();

  const updated = getConversationForUser(conversationId, user);
  if (!updated) {
    throw new ChatError('群聊不存在', 404);
  }
  return updated;
}

export function leaveConversation(conversationId: number, user: User) {
  const conversation = assertConversationAccess(conversationId, user);
  requireGroupConversation(conversation);

  if (conversation.created_by === user.id) {
    throw new ChatError('群主不能直接退群，请先解散群聊');
  }

  const now = chinaNowSql();
  db.transaction(() => {
    db.prepare(`
      DELETE FROM im_conversation_members
      WHERE conversation_id = ? AND user_id = ?
    `).run(conversationId, user.id);
    db.prepare('UPDATE im_conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);
  })();
}

export function dissolveConversation(conversationId: number, user: User) {
  const conversation = assertConversationAccess(conversationId, user);
  requireGroupConversation(conversation);
  assertManageConversation(conversation, user);

  const now = chinaNowSql();
  db.prepare(`
    UPDATE im_conversations
    SET deleted_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, conversationId);
}

export function updateConversationTitle(conversationId: number, title: string, user: User) {
  const conversation = assertConversationAccess(conversationId, user);
  requireGroupConversation(conversation);
  assertManageConversation(conversation, user);

  const cleanTitle = title.trim();
  if (!cleanTitle) {
    throw new ChatError('群聊名称不能为空');
  }

  const now = chinaNowSql();
  db.prepare(`
    UPDATE im_conversations
    SET title = ?, updated_at = ?
    WHERE id = ?
  `).run(cleanTitle, now, conversationId);

  const updated = getConversationForUser(conversationId, user);
  if (!updated) {
    throw new ChatError('群聊不存在', 404);
  }
  return updated;
}

export function updateMemberSettings(
  conversationId: number,
  targetUserId: number,
  payload: {
    doNotDisturb?: boolean;
    mutedUntil?: string | null;
  },
  user: User,
) {
  const conversation = assertConversationAccess(conversationId, user);
  const targetId = parseNumberId(targetUserId, '成员参数无效');
  const targetMembership = assertMembership(conversationId, targetId);

  const canSelfManage = targetId === user.id && typeof payload.doNotDisturb === 'boolean' && payload.mutedUntil === undefined;
  if (!canSelfManage) {
    requireGroupConversation(conversation);
    assertManageConversation(conversation, user);
    if (targetMembership.role === 'owner' && targetId !== user.id) {
      throw new ChatError('不能修改群主状态', 403);
    }
  }

  const updates: string[] = [];
  const values: Array<string | number | null> = [];

  if (typeof payload.doNotDisturb === 'boolean') {
    updates.push('do_not_disturb = ?');
    values.push(payload.doNotDisturb ? 1 : 0);
  }

  if (payload.mutedUntil !== undefined) {
    updates.push('muted_until = ?');
    values.push(payload.mutedUntil);
  }

  if (updates.length === 0) {
    throw new ChatError('没有可更新的设置');
  }

  db.prepare(`
    UPDATE im_conversation_members
    SET ${updates.join(', ')}
    WHERE conversation_id = ? AND user_id = ?
  `).run(...values, conversationId, targetId);

  const updated = getConversationForUser(conversationId, user);
  if (!updated) {
    throw new ChatError('会话不存在', 404);
  }
  return updated;
}

export function listMessages(
  user: User,
  conversationId: number,
  options?: { limit?: number; beforeId?: number | null },
): ChatMessagePage {
  assertConversationAccess(conversationId, user);
  const safeLimit = Math.min(Math.max(Number(options?.limit) || 30, 1), 100);
  const beforeId = options?.beforeId ? Number(options.beforeId) : null;
  const params: Array<number> = [conversationId];
  let whereSql = 'WHERE conversation_id = ?';

  if (beforeId && beforeId > 0) {
    whereSql += ' AND id < ?';
    params.push(beforeId);
  }

  params.push(safeLimit + 1);

  const rows = db
    .prepare(`
      SELECT * FROM (
        SELECT *
        FROM im_messages
        ${whereSql}
        ORDER BY id DESC
        LIMIT ?
      )
      ORDER BY id ASC
    `)
    .all(...params) as ChatMessageRow[];

  const hasMore = rows.length > safeLimit;
  const pageRows = hasMore ? rows.slice(1) : rows;
  const attachmentMap = attachmentsForMessages(pageRows.map((row) => row.id));
  const messages = pageRows.map((row) => normalizeMessage(row, attachmentMap.get(row.id) || []));

  return {
    messages,
    has_more: hasMore,
    next_before_id: messages[0]?.id || null,
  };
}

export function getMessageById(messageId: number): ChatMessage | null {
  const row = messageAccessRow(messageId);
  if (!row) return null;
  const attachmentMap = attachmentsForMessages([row.id]);
  return normalizeMessage(row, attachmentMap.get(row.id) || []);
}

export function createSystemMessage(user: User, conversationId: number, content: string): ChatMessage {
  assertConversationAccess(conversationId, user);
  const cleanContent = content.trim();
  if (!cleanContent) {
    throw new ChatError('系统消息内容不能为空');
  }

  const now = chinaNowSql();
  const result = db
    .prepare(`
      INSERT INTO im_messages
        (conversation_id, sender_id, sender_name, message_type, content, created_at, updated_at)
      VALUES (?, ?, ?, 'system', ?, ?, ?)
    `)
    .run(conversationId, user.id, user.name || user.username, cleanContent, now, now);

  db.prepare('UPDATE im_conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);

  const message = getMessageById(Number(result.lastInsertRowid));
  if (!message) {
    throw new ChatError('系统消息保存失败', 500);
  }
  return message;
}

export function markConversationRead(user: User, conversationId: number) {
  assertConversationAccess(conversationId, user);
  markConversationReadById(conversationId, user.id);
}

export function getUnreadTotal(user: User) {
  const row = db
    .prepare(`
      SELECT COUNT(*) as count
      FROM im_messages unread
      WHERE unread.sender_id <> ?
        AND EXISTS (
          SELECT 1
          FROM im_conversation_members cm
          WHERE cm.conversation_id = unread.conversation_id AND cm.user_id = ?
        )
        AND unread.id > COALESCE((
          SELECT r.last_read_message_id
          FROM im_conversation_reads r
          WHERE r.conversation_id = unread.conversation_id AND r.user_id = ?
        ), 0)
    `)
    .get(user.id, user.id, user.id) as { count: number } | undefined;

  return Number(row?.count || 0);
}

function assertCanSendMessage(conversationId: number, user: User) {
  const conversation = assertConversationAccess(conversationId, user);
  const membership = assertMembership(conversationId, user.id);
  if (conversation.type === 'group' && isMuted(membership)) {
    throw new ChatError('您已被群主禁言，暂时无法发言', 403);
  }
  return conversation;
}

export function createTextMessage(user: User, conversationId: number, content: string): ChatMessage {
  assertCanSendMessage(conversationId, user);
  const cleanContent = content.trim();

  if (!cleanContent) {
    throw new ChatError('消息内容不能为空');
  }
  if (cleanContent.length > 5000) {
    throw new ChatError('消息内容不能超过 5000 个字符');
  }

  const now = chinaNowSql();
  const result = db
    .prepare(`
      INSERT INTO im_messages
        (conversation_id, sender_id, sender_name, message_type, content, created_at, updated_at)
      VALUES (?, ?, ?, 'text', ?, ?, ?)
    `)
    .run(conversationId, user.id, user.name || user.username, cleanContent, now, now);

  db.prepare('UPDATE im_conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);
  markConversationReadById(conversationId, user.id, now);

  const message = getMessageById(Number(result.lastInsertRowid));
  if (!message) {
    throw new ChatError('消息发送失败', 500);
  }
  return message;
}

export function createFileMessage(
  user: User,
  conversationId: number,
  file: StoredChatFile,
  content?: string,
): ChatMessage {
  assertCanSendMessage(conversationId, user);
  const now = chinaNowSql();
  const messageType: ChatMessageType = file.isImage ? 'image' : 'file';

  const messageId = db.transaction(() => {
    const result = db
      .prepare(`
        INSERT INTO im_messages
          (conversation_id, sender_id, sender_name, message_type, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(conversationId, user.id, user.name || user.username, messageType, content?.trim() || file.originalName, now, now);

    const id = Number(result.lastInsertRowid);
    db.prepare(`
      INSERT INTO im_attachments
        (message_id, conversation_id, file_name, original_name, mime_type, file_ext, size, compressed_size, storage_path, is_image, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      conversationId,
      file.fileName,
      file.originalName,
      file.mimeType,
      file.fileExt,
      file.size,
      file.compressedSize,
      file.storagePath,
      file.isImage ? 1 : 0,
      now,
    );

    db.prepare('UPDATE im_conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);
    markConversationReadById(conversationId, user.id, now);
    return id;
  })();

  const message = getMessageById(messageId);
  if (!message) {
    throw new ChatError('文件消息保存失败', 500);
  }
  return message;
}

export function recallMessage(user: User, messageId: number): ChatMessage {
  const row = messageAccessRow(messageId);
  if (!row) {
    throw new ChatError('消息不存在', 404);
  }

  const conversation = assertConversationAccess(row.conversation_id, user);
  const canManage = conversation.type === 'group' && canManageConversation(conversation, user);
  const isSelfMessage = row.sender_id === user.id;

  if (row.message_type === 'system') {
    throw new ChatError('系统消息不能撤回', 403);
  }
  if (!isSelfMessage && !canManage) {
    throw new ChatError('只能撤回自己发送的消息', 403);
  }
  if (row.recalled === 1) {
    const currentMessage = getMessageById(messageId);
    if (!currentMessage) {
      throw new ChatError('消息不存在', 404);
    }
    return currentMessage;
  }

  const createdAt = parseChinaTime(row.created_at)?.getTime();
  const elapsedSeconds = createdAt ? (nowTime() - createdAt) / 1000 : Number.POSITIVE_INFINITY;
  if (elapsedSeconds > CHAT_RECALL_WINDOW_SECONDS) {
    throw new ChatError(`消息只能在 ${CHAT_RECALL_WINDOW_SECONDS} 秒内撤回`, 403);
  }

  const now = chinaNowSql();
  db.prepare(`
    UPDATE im_messages
    SET recalled = 1, recalled_at = ?, recalled_by = ?, updated_at = ?
    WHERE id = ?
  `).run(now, user.id, now, messageId);

  markConversationReadById(row.conversation_id, user.id, now);
  const message = getMessageById(messageId);
  if (!message) {
    throw new ChatError('消息不存在', 404);
  }
  return message;
}

export function getAttachmentForAccess(user: User, attachmentId: number): ChatAttachmentAccess {
  const row = db
    .prepare(`
      SELECT
        a.*,
        m.recalled as message_recalled
      FROM im_attachments a
      JOIN im_messages m ON m.id = a.message_id
      JOIN im_conversations c ON c.id = a.conversation_id
      WHERE a.id = ?
        AND c.deleted_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM im_conversation_members cm
          WHERE cm.conversation_id = a.conversation_id AND cm.user_id = ?
        )
      LIMIT 1
    `)
    .get(attachmentId, user.id) as ChatAttachmentAccess | undefined;

  if (!row) {
    throw new ChatError('文件不存在或无权访问', 404);
  }
  if (row.message_recalled === 1) {
    throw new ChatError('消息已撤回，文件不可访问', 410);
  }
  return row;
}
