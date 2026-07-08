'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  ArrowLeft,
  AtSign,
  BellOff,
  Camera,
  Crown,
  FileUp,
  Loader2,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldBan,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  Volume2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  ChatConversation,
  ChatMember,
  ChatMessage,
  ChatMessagePage,
  ChatUserOption,
} from '@/types/realtime-chat';

type AppUser = {
  id: number;
  username: string;
  name: string;
  avatar?: string;
  role: string;
  department?: string;
};

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

type ConversationFilter = 'all' | 'group' | 'direct' | 'users';

type UserCardState = {
  id: number;
  name: string;
  username: string;
  avatar?: string | null;
  role?: string;
  department?: string | null;
  mutedUntil?: string | null;
  doNotDisturb?: 0 | 1;
};

type JuxingAndroidBridge = {
  notify?: (title: string, body: string, tag: string) => void;
};

interface RealtimeChatPageProps {
  user?: AppUser;
  compact?: boolean;
}

const RECALL_WINDOW_SECONDS = 120;
const HISTORY_PAGE_SIZE = 30;

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers || {}),
    },
  });
  const json = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok || json.success === false) {
    throw new Error(json.error || '请求失败');
  }
  return json.data as T;
}

function parseChinaDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(`${value.replace(' ', 'T')}+08:00`);
}

function formatMessageTime(value: string) {
  const date = parseChinaDate(value);
  if (!date || Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortTime(value: string | null) {
  if (!value) return '';
  const date = parseChinaDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMuteText(value: string | null | undefined) {
  if (!value) return '未禁言';
  const date = parseChinaDate(value);
  if (!date || Number.isNaN(date.getTime())) return '已禁言';
  if (date.getTime() <= Date.now()) return '未禁言';
  return `禁言至 ${formatMessageTime(value)}`;
}

function messagePreview(message: ChatMessage) {
  if (message.recalled === 1) return '[消息已撤回]';
  if (message.message_type === 'system') return message.content || '[系统消息]';
  if (message.message_type === 'image') return '[图片]';
  if (message.message_type === 'file') return '[文件]';
  return message.content || '';
}

function initials(name?: string | null) {
  return (name || '我').trim().slice(0, 1).toUpperCase();
}

function unreadText(count: number) {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

function upsertMessage(list: ChatMessage[], message: ChatMessage) {
  const exists = list.some((item) => item.id === message.id);
  const next = exists ? list.map((item) => (item.id === message.id ? message : item)) : [...list, message];
  return next.sort((a, b) => a.id - b.id);
}

function upsertConversation(list: ChatConversation[], conversation: ChatConversation) {
  const exists = list.some((item) => item.id === conversation.id);
  const next = exists
    ? list.map((item) => (item.id === conversation.id ? conversation : item))
    : [conversation, ...list];

  return next.sort((a, b) => {
    const aTime = a.last_message_at || a.updated_at || a.created_at;
    const bTime = b.last_message_at || b.updated_at || b.created_at;
    return (parseChinaDate(bTime)?.getTime() || 0) - (parseChinaDate(aTime)?.getTime() || 0);
  });
}

function isHistoryNearBottom(history: HTMLDivElement | null) {
  if (!history) return true;
  return history.scrollHeight - history.scrollTop - history.clientHeight < 160;
}

function canManageConversation(conversation: ChatConversation | null, user?: AppUser) {
  if (!conversation || !user || conversation.type !== 'group') return false;
  return (
    user.role === 'admin' ||
    user.role === 'super_admin' ||
    conversation.created_by === user.id ||
    conversation.members.some((member) => member.user_id === user.id && member.role === 'owner')
  );
}

function canRecallMessage(message: ChatMessage, conversation: ChatConversation | null, user?: AppUser) {
  if (!conversation || !user || message.recalled === 1 || message.message_type === 'system') return false;
  const createdAt = parseChinaDate(message.created_at)?.getTime();
  if (!createdAt || Number.isNaN(createdAt)) return false;
  const withinRecallWindow = Date.now() - createdAt <= RECALL_WINDOW_SECONDS * 1000;
  if (!withinRecallWindow) return false;
  return message.sender_id === user.id || canManageConversation(conversation, user);
}

function chinaDateTimeAfterMinutes(minutes: number) {
  const target = new Date(Date.now() + minutes * 60 * 1000);
  const chinaTime = new Date(target.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const year = chinaTime.getFullYear();
  const month = String(chinaTime.getMonth() + 1).padStart(2, '0');
  const day = String(chinaTime.getDate()).padStart(2, '0');
  const hour = String(chinaTime.getHours()).padStart(2, '0');
  const minute = String(chinaTime.getMinutes()).padStart(2, '0');
  const second = String(chinaTime.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function buildUserCard(member: ChatMember | undefined, userOption?: ChatUserOption | null): UserCardState | null {
  if (!member && !userOption) return null;

  return {
    id: member?.user_id || userOption?.id || 0,
    name: member?.name || userOption?.name || '',
    username: member?.username || userOption?.username || '',
    avatar: member?.avatar || userOption?.avatar || null,
    role: userOption?.role || member?.role,
    department: userOption?.department || null,
    mutedUntil: member?.muted_until || null,
    doNotDisturb: member?.do_not_disturb || 0,
  };
}

let notificationAudioContext: AudioContext | null = null;
let notificationAudioUnlocked = false;

function getNotificationAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  notificationAudioContext ||= new AudioContextClass();
  return notificationAudioContext;
}

async function unlockNotificationSound() {
  const context = getNotificationAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    await context.resume().catch(() => undefined);
  }
  if (notificationAudioUnlocked || context.state !== 'running') return;

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  gainNode.gain.value = 0.00001;
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.01);
  notificationAudioUnlocked = true;
}

async function playNotificationSound() {
  const context = getNotificationAudioContext();
  if (!context) return;

  await unlockNotificationSound();
  if (context.state !== 'running') return;

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(920, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1240, context.currentTime + 0.08);
  gainNode.gain.value = 0.0001;
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  const now = context.currentTime;
  gainNode.gain.exponentialRampToValueAtTime(0.09, now + 0.018);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  oscillator.start(now);
  oscillator.stop(now + 0.22);
}

function showAndroidMessageNotification(message: ChatMessage, conversation?: ChatConversation | null) {
  if (typeof window === 'undefined') return;

  const bridge = (window as typeof window & { JuxingAndroid?: JuxingAndroidBridge }).JuxingAndroid;
  if (!bridge?.notify) return;

  const preview = messagePreview(message) || '你有一条新消息';
  const sender = conversation?.members.find((member) => member.user_id === message.sender_id);
  const title = conversation?.title || '聚星新消息';
  const body = conversation?.type === 'group' && sender?.name ? `${sender.name}：${preview}` : preview;

  try {
    bridge.notify(title, body, `chat-${message.conversation_id}`);
  } catch (error) {
    console.error('Android 原生通知发送失败:', error);
  }
}

function notifyChatUnreadChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('realtime-chat-unread-changed'));
}

export default function RealtimeChatPage({ user, compact = false }: RealtimeChatPageProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'leave' | 'dissolve'>('leave');
  const [actionLoading, setActionLoading] = useState(false);
  const [users, setUsers] = useState<ChatUserOption[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [currentAvatar, setCurrentAvatar] = useState(user?.avatar || null);
  const [userCard, setUserCard] = useState<UserCardState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const activeConversationIdRef = useRef<number | null>(null);
  const conversationsRef = useRef<ChatConversation[]>([]);
  const soundEnabledRef = useRef(soundEnabled);
  const loadingMoreMessagesRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const preserveScrollRef = useRef<{ height: number; top: number } | null>(null);
  const shouldScrollToBottomRef = useRef(false);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) || null,
    [activeConversationId, conversations],
  );

  const currentMember = useMemo(
    () => activeConversation?.members.find((member) => member.user_id === user?.id) || null,
    [activeConversation, user?.id],
  );

  const activeMemberIds = useMemo(() => new Set(activeConversation?.members.map((member) => member.user_id) || []), [activeConversation]);

  const visibleConversations = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (filter === 'users') return false;
      if (filter !== 'all' && conversation.type !== filter) return false;
      if (!keyword) return true;
      const members = conversation.members.map((member) => `${member.name} ${member.username}`).join(' ');
      return `${conversation.title} ${conversation.last_message_preview || ''} ${members}`.toLowerCase().includes(keyword);
    });
  }, [conversations, filter, query]);

  const visibleDirectUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return users
      .filter((item) => item.id !== user?.id)
      .filter((item) => {
        if (!keyword) return true;
        return `${item.name} ${item.username} ${item.department || ''} ${item.role || ''}`.toLowerCase().includes(keyword);
      });
  }, [query, user?.id, users]);

  const selectableUsers = useMemo(() => {
    const keyword = memberQuery.trim().toLowerCase();
    return users
      .filter((item) => item.id !== user?.id)
      .filter((item) => {
        if (!keyword) return true;
        return `${item.name} ${item.username} ${item.department || ''}`.toLowerCase().includes(keyword);
      });
  }, [memberQuery, user?.id, users]);

  const addableUsers = useMemo(() => selectableUsers.filter((item) => !activeMemberIds.has(item.id)), [activeMemberIds, selectableUsers]);

  const canManage = canManageConversation(activeConversation, user);

  const markReadLocally = useCallback((conversationId: number) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unread_count: 0 } : conversation,
      ),
    );
    notifyChatUnreadChanged();
  }, []);

  const markConversationRead = useCallback(
    async (conversationId: number) => {
      markReadLocally(conversationId);
      try {
        await fetch(`/api/realtime-chat/conversations/${conversationId}/read`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch (readError) {
        console.error('标记会话已读失败:', readError);
      }
    },
    [markReadLocally],
  );

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    setError('');
    try {
      const data = await fetchJson<ChatConversation[]>('/api/realtime-chat/conversations');
      setConversations(data);
      setActiveConversationId((current) => {
        if (current && data.some((item) => item.id === current)) return current;
        return compact ? null : data[0]?.id || null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '会话加载失败');
    } finally {
      setLoadingConversations(false);
    }
  }, [compact]);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await fetchJson<ChatUserOption[]>('/api/realtime-chat/users'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '用户列表加载失败');
    }
  }, []);

  const loadMessages = useCallback(
    async (conversationId: number, beforeId?: number | null) => {
      if (beforeId) {
        if (loadingMoreMessagesRef.current) return;
        const history = historyRef.current;
        preserveScrollRef.current = {
          height: history?.scrollHeight || 0,
          top: history?.scrollTop || 0,
        };
        shouldScrollToBottomRef.current = false;
        loadingMoreMessagesRef.current = true;
        setLoadingMoreMessages(true);
      } else {
        setLoadingMessages(true);
        shouldScrollToBottomRef.current = true;
      }

      setError('');
      try {
        const page = await fetchJson<ChatMessagePage>(
          `/api/realtime-chat/messages?conversationId=${conversationId}&limit=${HISTORY_PAGE_SIZE}${
            beforeId ? `&beforeId=${beforeId}` : ''
          }`,
        );

        setHasMoreMessages(page.has_more);
        if (beforeId) {
          setMessages((current) => [...page.messages, ...current]);
        } else {
          setMessages(page.messages);
          markReadLocally(conversationId);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '消息加载失败');
      } finally {
        if (beforeId) {
          loadingMoreMessagesRef.current = false;
          setLoadingMoreMessages(false);
        } else {
          setLoadingMessages(false);
        }
      }
    },
    [markReadLocally],
  );

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    loadingMoreMessagesRef.current = loadingMoreMessages;
  }, [loadingMoreMessages]);

  useEffect(() => {
    const unlock = () => {
      void unlockNotificationSound();
    };

    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!compact || !activeConversationId) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousOverscroll = document.documentElement.style.getPropertyValue('overscroll-behavior');

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.setProperty('overscroll-behavior', 'none');

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.documentElement.style.setProperty('overscroll-behavior', previousOverscroll);
    };
  }, [activeConversationId, compact]);

  useEffect(() => {
    const savedSoundEnabled = window.localStorage.getItem('chat-sound-enabled');
    if (savedSoundEnabled === 'false') {
      setSoundEnabled(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
    void loadUsers();
  }, [loadConversations, loadUsers]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
    if (activeConversationId) {
      void loadMessages(activeConversationId);
      socketRef.current?.emit('chat:join', { conversationId: activeConversationId });
    } else {
      setMessages([]);
      setHasMoreMessages(false);
    }
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    const socket = io({
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => setSocketConnected(false));
    socket.on('chat:message', (message: ChatMessage) => {
      const activeId = activeConversationIdRef.current;
      if (activeId === message.conversation_id) {
        const shouldKeepBottom = isHistoryNearBottom(historyRef.current) || message.sender_id === user?.id;
        setMessages((current) => upsertMessage(current, message));
        shouldScrollToBottomRef.current = shouldKeepBottom;
        void markConversationRead(message.conversation_id);
      }

      const currentConversation = conversationsRef.current.find((conversation) => conversation.id === message.conversation_id);
      const selfMember = currentConversation?.members.find((member) => member.user_id === user?.id);
      const shouldPlay = Boolean(
        message.sender_id !== user?.id &&
          soundEnabledRef.current &&
          selfMember?.do_not_disturb !== 1,
      );

      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.id !== message.conversation_id) return conversation;
          return {
            ...conversation,
            last_message_at: message.created_at,
            last_message_preview: messagePreview(message),
            updated_at: message.created_at,
            unread_count:
              activeId === message.conversation_id || message.sender_id === user?.id
                ? 0
                : conversation.unread_count + 1,
          };
        }),
      );

      if (shouldPlay) {
        void playNotificationSound();
        showAndroidMessageNotification(message, currentConversation);
      }
      notifyChatUnreadChanged();
    });

    socket.on('chat:message-recalled', (message: ChatMessage) => {
      if (activeConversationIdRef.current === message.conversation_id) {
        setMessages((current) => upsertMessage(current, message));
      }
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === message.conversation_id
            ? {
                ...conversation,
                last_message_preview: '[消息已撤回]',
                updated_at: message.updated_at || message.created_at,
              }
            : conversation,
        ),
      );
    });

    socket.on('chat:conversation-updated', (conversation: ChatConversation) => {
      setConversations((current) => upsertConversation(current, conversation));
      setActiveConversationId((current) => current || (compact ? null : conversation.id));
    });

    socket.on('chat:conversation-removed', (payload: { conversationId?: number; reason?: string }) => {
      const removedId = Number(payload?.conversationId || 0);
      if (!removedId) return;
      setConversations((current) => current.filter((conversation) => conversation.id !== removedId));
      setActiveConversationId((current) => (current === removedId ? null : current));
      if (payload.reason) {
        setToastMessage(payload.reason);
      }
      if (activeConversationIdRef.current === removedId) {
        setMessages([]);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [compact, markConversationRead, user?.id]);

  useEffect(() => {
    const history = historyRef.current;
    if (!history) return;

    if (preserveScrollRef.current) {
      const { height, top } = preserveScrollRef.current;
      const nextHeight = history.scrollHeight;
      history.scrollTop = nextHeight - height + top;
      preserveScrollRef.current = null;
      return;
    }

    if (shouldScrollToBottomRef.current) {
      history.scrollTop = history.scrollHeight;
      shouldScrollToBottomRef.current = false;
    }
  }, [messages]);

  const toggleSelectedUser = (userId: number) => {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const openGroupDialog = () => {
    setGroupTitle('');
    setSelectedUserIds([]);
    setMemberQuery('');
    setGroupDialogOpen(true);
    void loadUsers();
  };

  const openMemberDialog = () => {
    setSelectedUserIds([]);
    setMemberQuery('');
    setMemberDialogOpen(true);
    void loadUsers();
  };

  const createGroup = async () => {
    try {
      const conversation = await fetchJson<ChatConversation>('/api/realtime-chat/conversations', {
        method: 'POST',
        body: JSON.stringify({ type: 'group', title: groupTitle, memberIds: selectedUserIds }),
      });
      setConversations((current) => upsertConversation(current, conversation));
      setActiveConversationId(conversation.id);
      setGroupDialogOpen(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '群聊创建失败');
    }
  };

  const startDirect = async (targetUserId: number) => {
    try {
      const conversation = await fetchJson<ChatConversation>('/api/realtime-chat/conversations', {
        method: 'POST',
        body: JSON.stringify({ type: 'direct', targetUserId }),
      });
      setConversations((current) => upsertConversation(current, conversation));
      setActiveConversationId(conversation.id);
      setMemberDialogOpen(false);
      setGroupDialogOpen(false);
    } catch (directError) {
      setError(directError instanceof Error ? directError.message : '私信创建失败');
    }
  };

  const addMembers = async () => {
    if (!activeConversationId) return;
    try {
      const conversation = await fetchJson<ChatConversation>(
        `/api/realtime-chat/conversations/${activeConversationId}/members`,
        {
          method: 'POST',
          body: JSON.stringify({ memberIds: selectedUserIds }),
        },
      );
      setConversations((current) => upsertConversation(current, conversation));
      setSelectedUserIds([]);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : '添加成员失败');
    }
  };

  const removeMember = async (memberId: number) => {
    if (!activeConversationId) return;
    try {
      const conversation = await fetchJson<ChatConversation>(
        `/api/realtime-chat/conversations/${activeConversationId}/members`,
        {
          method: 'DELETE',
          body: JSON.stringify({ memberId }),
        },
      );
      setConversations((current) => upsertConversation(current, conversation));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '移除成员失败');
    }
  };

  const updateDoNotDisturb = async (checked: boolean) => {
    if (!activeConversationId) return;
    try {
      const conversation = await fetchJson<ChatConversation>(
        `/api/realtime-chat/conversations/${activeConversationId}/members`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            targetUserId: user?.id,
            doNotDisturb: checked,
          }),
        },
      );
      setConversations((current) => upsertConversation(current, conversation));
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : '免打扰设置失败');
    }
  };

  const muteMember = async (memberId: number, minutes: number | null) => {
    if (!activeConversationId) return;
    try {
      const conversation = await fetchJson<ChatConversation>(
        `/api/realtime-chat/conversations/${activeConversationId}/members`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            targetUserId: memberId,
            mutedUntil: minutes ? chinaDateTimeAfterMinutes(minutes) : null,
          }),
        },
      );
      setConversations((current) => upsertConversation(current, conversation));
    } catch (muteError) {
      setError(muteError instanceof Error ? muteError.message : '禁言设置失败');
    }
  };

  const renameConversation = async () => {
    if (!activeConversationId || !groupTitle.trim()) return;
    try {
      const conversation = await fetchJson<ChatConversation>(`/api/realtime-chat/conversations/${activeConversationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: groupTitle.trim() }),
      });
      setConversations((current) => upsertConversation(current, conversation));
      setGroupTitle('');
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : '群聊名称修改失败');
    }
  };

  const leaveOrDissolveConversation = async () => {
    if (!activeConversationId) return;
    setActionLoading(true);
    try {
      await fetchJson<{ conversationId: number }>(`/api/realtime-chat/conversations/${activeConversationId}`, {
        method: 'DELETE',
        body: JSON.stringify({ action: confirmAction }),
      });
      setConversations((current) => current.filter((conversation) => conversation.id !== activeConversationId));
      setActiveConversationId(null);
      setMemberDialogOpen(false);
      setConfirmOpen(false);
    } catch (conversationError) {
      setError(conversationError instanceof Error ? conversationError.message : '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const sendText = async () => {
    if (!activeConversationId || !draft.trim()) return;
    setSending(true);
    setError('');
    const content = draft;
    setDraft('');

    try {
      const message = await fetchJson<ChatMessage>('/api/realtime-chat/messages', {
        method: 'POST',
        body: JSON.stringify({ conversationId: activeConversationId, content }),
      });
      setMessages((current) => upsertMessage(current, message));
      markReadLocally(activeConversationId);
      shouldScrollToBottomRef.current = true;
    } catch (sendError) {
      setDraft(content);
      setError(sendError instanceof Error ? sendError.message : '消息发送失败');
    } finally {
      setSending(false);
    }
  };

  const uploadFile = async (file: File | undefined) => {
    if (!file || !activeConversationId) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('conversationId', String(activeConversationId));
      formData.append('file', file);
      const message = await fetchJson<ChatMessage>('/api/realtime-chat/upload', {
        method: 'POST',
        body: formData,
      });
      setMessages((current) => upsertMessage(current, message));
      markReadLocally(activeConversationId);
      shouldScrollToBottomRef.current = true;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '文件上传失败');
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setAvatarUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await fetchJson<{ avatar: string }>('/api/user/avatar', {
        method: 'POST',
        body: formData,
      });
      setCurrentAvatar(data.avatar);
      setUsers((current) =>
        current.map((item) => (item.id === user?.id ? { ...item, avatar: data.avatar } : item)),
      );
      setConversations((current) =>
        current.map((conversation) => ({
          ...conversation,
          members: conversation.members.map((member) =>
            member.user_id === user?.id ? { ...member, avatar: data.avatar } : member,
          ),
        })),
      );
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : '头像上传失败');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const recall = async (message: ChatMessage) => {
    if (!canRecallMessage(message, activeConversation, user)) return;
    try {
      const recalled = await fetchJson<ChatMessage>(`/api/realtime-chat/messages/${message.id}/recall`, {
        method: 'POST',
      });
      setMessages((current) => upsertMessage(current, recalled));
    } catch (recallError) {
      setError(recallError instanceof Error ? recallError.message : '消息撤回失败');
    }
  };

  const loadMoreHistory = async () => {
    if (!activeConversationId || !hasMoreMessages || loadingMoreMessages || !messages.length) return;
    await loadMessages(activeConversationId, messages[0]?.id);
  };

  const openUserCard = (member?: ChatMember, userOption?: ChatUserOption | null) => {
    setUserCard(buildUserCard(member, userOption));
  };

  const openUserOptionCard = (userOption: ChatUserOption) => {
    openUserCard(undefined, userOption);
  };

  const appendMention = (member: ChatMember) => {
    setDraft((current) => `${current}${current.endsWith(' ') || !current ? '' : ' '}@${member.name} `);
  };

  const openDirectUserCard = () => {
    if (!activeConversation || activeConversation.type !== 'direct') return;
    const peer = activeConversation.members.find((member) => member.user_id !== user?.id);
    if (!peer) return;
    openUserCard(peer, users.find((item) => item.id === peer.user_id) || null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendText();
    }
  };

  const conversationList = (
    <ConversationList
      compact={compact}
      conversations={visibleConversations}
      users={visibleDirectUsers}
      activeConversationId={activeConversationId}
      query={query}
      filter={filter}
      loading={loadingConversations}
      socketConnected={socketConnected}
      currentUserName={user?.name || user?.username}
      currentAvatar={currentAvatar}
      avatarUploading={avatarUploading}
      soundEnabled={soundEnabled}
      onQueryChange={setQuery}
      onFilterChange={setFilter}
      onSelect={setActiveConversationId}
      onRefresh={() => void loadConversations()}
      onCreateGroup={openGroupDialog}
      onPickAvatar={() => avatarInputRef.current?.click()}
      onStartDirect={(userId) => void startDirect(userId)}
      onOpenUserOptionCard={openUserOptionCard}
      onToggleSound={(enabled) => {
        setSoundEnabled(enabled);
        window.localStorage.setItem('chat-sound-enabled', String(enabled));
        if (enabled) {
          void unlockNotificationSound();
        }
      }}
    />
  );

  return (
    <div className={cn('relative h-[calc(100vh-3.5rem)] bg-[#e8edf5]', compact && 'h-[calc(100dvh-10.4rem)] bg-transparent')}>
      <input
        ref={avatarInputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => void uploadAvatar(event.target.files?.[0])}
      />

      {compact ? (
        <div
          className={cn(
            'h-full overflow-hidden rounded-[26px] border border-white/70 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]',
            activeConversation && 'fixed inset-0 z-[45] h-screen h-[100dvh] w-screen rounded-none border-0 shadow-none',
          )}
        >
          {activeConversation ? (
            <ChatPanel
              compact
              user={user}
              conversation={activeConversation}
              messages={messages}
              draft={draft}
              error={error}
              sending={sending}
              uploading={uploading}
              loadingMessages={loadingMessages}
              loadingMoreMessages={loadingMoreMessages}
              hasMoreMessages={hasMoreMessages}
              imageInputRef={imageInputRef}
              fileInputRef={fileInputRef}
              historyRef={historyRef}
              onBack={() => setActiveConversationId(null)}
              onDraftChange={setDraft}
              onKeyDown={handleKeyDown}
              onSend={() => void sendText()}
              onUpload={uploadFile}
              onRecall={(message) => void recall(message)}
              onOpenMembers={openMemberDialog}
              onOpenDirectUserCard={openDirectUserCard}
              onOpenUserCard={(member) => openUserCard(member, users.find((item) => item.id === member.user_id) || null)}
              onHistoryTop={loadMoreHistory}
            />
          ) : (
            conversationList
          )}
        </div>
      ) : (
        <div className="grid h-full grid-cols-[360px_minmax(0,1fr)] gap-4 p-4">
          {conversationList}
          <ChatPanel
            compact={false}
            user={user}
            conversation={activeConversation}
            messages={messages}
            draft={draft}
            error={error}
            sending={sending}
            uploading={uploading}
            loadingMessages={loadingMessages}
            loadingMoreMessages={loadingMoreMessages}
            hasMoreMessages={hasMoreMessages}
            imageInputRef={imageInputRef}
            fileInputRef={fileInputRef}
            historyRef={historyRef}
            onBack={() => setActiveConversationId(null)}
            onDraftChange={setDraft}
            onKeyDown={handleKeyDown}
            onSend={() => void sendText()}
            onUpload={uploadFile}
            onRecall={(message) => void recall(message)}
            onOpenMembers={openMemberDialog}
            onOpenDirectUserCard={openDirectUserCard}
            onOpenUserCard={(member) => openUserCard(member, users.find((item) => item.id === member.user_id) || null)}
            onHistoryTop={loadMoreHistory}
          />
        </div>
      )}

      {toastMessage && (
        <button
          type="button"
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[90] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-slate-950/90 px-4 py-2 text-sm text-white shadow-xl"
          onClick={() => setToastMessage('')}
        >
          {toastMessage}
        </button>
      )}

      <GroupDialog
        open={groupDialogOpen}
        title={groupTitle}
        users={selectableUsers}
        selectedIds={selectedUserIds}
        memberQuery={memberQuery}
        onOpenChange={setGroupDialogOpen}
        onTitleChange={setGroupTitle}
        onMemberQueryChange={setMemberQuery}
        onToggleUser={toggleSelectedUser}
        onStartDirect={(userId) => void startDirect(userId)}
        onCreate={() => void createGroup()}
      />

      <MembersDialog
        open={memberDialogOpen}
        compact={compact}
        conversation={activeConversation}
        users={addableUsers}
        selectedIds={selectedUserIds}
        memberQuery={memberQuery}
        currentUserId={user?.id}
        currentUserDnd={currentMember?.do_not_disturb === 1}
        canManage={canManage}
        renameValue={groupTitle}
        actionLoading={actionLoading}
        onOpenChange={setMemberDialogOpen}
        onMemberQueryChange={setMemberQuery}
        onToggleUser={toggleSelectedUser}
        onStartDirect={(userId) => void startDirect(userId)}
        onRemove={(userId) => void removeMember(userId)}
        onAdd={() => void addMembers()}
        onOpenUserCard={(member) => openUserCard(member, users.find((item) => item.id === member.user_id) || null)}
        onMention={appendMention}
        onMute={(memberId, minutes) => void muteMember(memberId, minutes)}
        onToggleDnd={(checked) => void updateDoNotDisturb(checked)}
        onRenameValueChange={setGroupTitle}
        onRename={() => void renameConversation()}
        onLeave={() => {
          setConfirmAction('leave');
          setConfirmOpen(true);
        }}
        onDissolve={() => {
          setConfirmAction('dissolve');
          setConfirmOpen(true);
        }}
      />

      <UserCardDialog
        userCard={userCard}
        onOpenChange={(open) => {
          if (!open) setUserCard(null);
        }}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction === 'dissolve' ? '确认解散群聊' : '确认退出群聊'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'dissolve'
                ? '解散后所有成员都会失去该群聊入口。'
                : '退出后你将不再接收这个群聊的新消息。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void leaveOrDissolveConversation()} disabled={actionLoading}>
              {actionLoading ? '处理中...' : '确认'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConversationList({
  compact,
  conversations,
  users,
  activeConversationId,
  query,
  filter,
  loading,
  socketConnected,
  currentUserName,
  currentAvatar,
  avatarUploading,
  soundEnabled,
  onQueryChange,
  onFilterChange,
  onSelect,
  onRefresh,
  onCreateGroup,
  onPickAvatar,
  onStartDirect,
  onOpenUserOptionCard,
  onToggleSound,
}: {
  compact: boolean;
  conversations: ChatConversation[];
  users: ChatUserOption[];
  activeConversationId: number | null;
  query: string;
  filter: ConversationFilter;
  loading: boolean;
  socketConnected: boolean;
  currentUserName?: string;
  currentAvatar: string | null;
  avatarUploading: boolean;
  soundEnabled: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: ConversationFilter) => void;
  onSelect: (conversationId: number) => void;
  onRefresh: () => void;
  onCreateGroup: () => void;
  onPickAvatar: () => void;
  onStartDirect: (userId: number) => void;
  onOpenUserOptionCard: (userOption: ChatUserOption) => void;
  onToggleSound: (enabled: boolean) => void;
}) {
  const showUsers = filter === 'users';

  return (
    <aside className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border border-white/70 bg-white shadow-sm', compact && 'rounded-none border-0 shadow-none')}>
      <div className={cn('border-b border-slate-100 bg-white px-4 py-3', compact && 'px-3 py-3')}>
        <div className="flex items-center gap-3">
          <button type="button" className="relative shrink-0" onClick={onPickAvatar} disabled={avatarUploading}>
            <UserAvatar name={currentUserName || '我'} avatar={currentAvatar} className="h-11 w-11 border border-slate-200" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white ring-2 ring-white">
              <Camera className="h-2.5 w-2.5" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className={cn('truncate font-semibold text-slate-950', compact ? 'text-lg' : 'text-base')}>聊天</h2>
              <span className={cn('h-2 w-2 rounded-full', socketConnected ? 'bg-emerald-500' : 'bg-slate-300')} />
            </div>
            <p className="truncate text-xs text-slate-500">{socketConnected ? '实时在线' : '连接中'}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button type="button" size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700" onClick={onCreateGroup}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-50 p-2">
          <Volume2 className="h-4 w-4 text-slate-400" />
          <div className="text-xs text-slate-500">来消息提示音</div>
          <div className="flex-1" />
          <Switch checked={soundEnabled} onCheckedChange={onToggleSound} />
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索会话、成员或消息"
            className="h-11 rounded-full border-slate-200 bg-slate-50 pl-9"
          />
        </div>

        <Tabs value={filter} onValueChange={(value) => onFilterChange(value as ConversationFilter)} className="mt-3">
          <TabsList className="grid h-10 w-full grid-cols-4 rounded-full bg-slate-100 p-1">
            <TabsTrigger value="all" className="rounded-full px-0 text-xs sm:text-sm">
              全部
            </TabsTrigger>
            <TabsTrigger value="group" className="rounded-full px-0 text-xs sm:text-sm">
              群聊
            </TabsTrigger>
            <TabsTrigger value="direct" className="rounded-full px-0 text-xs sm:text-sm">
              私信
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-full px-0 text-xs sm:text-sm">
              用户
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="divide-y divide-slate-100">
          {showUsers
            ? users.map((item) => (
                <DirectUserRow
                  key={item.id}
                  userOption={item}
                  onStartDirect={onStartDirect}
                  onOpenUserOptionCard={onOpenUserOptionCard}
                />
              ))
            : conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50',
                    conversation.id === activeConversationId && 'bg-[#eef6ff]',
                  )}
                  onClick={() => onSelect(conversation.id)}
                >
                  <ConversationAvatar conversation={conversation} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-950">{conversation.title}</span>
                      {conversation.type === 'group' && (
                        <span className="shrink-0 text-[11px] text-slate-400">({conversation.member_count})</span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {conversation.last_message_preview || '暂无消息'}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-slate-400">{formatShortTime(conversation.last_message_at)}</span>
                    {conversation.unread_count > 0 && (
                      <span className="min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white">
                        {unreadText(conversation.unread_count)}
                      </span>
                    )}
                  </span>
                </button>
              ))}

          {showUsers && !users.length && (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              <Users className="mx-auto mb-3 h-9 w-9 text-slate-300" />
              没有找到可私信的用户。
            </div>
          )}

          {!showUsers && !conversations.length && (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              <MessageCircle className="mx-auto mb-3 h-9 w-9 text-slate-300" />
              暂无会话，点击右上角新建群聊或私信。
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function DirectUserRow({
  userOption,
  onStartDirect,
  onOpenUserOptionCard,
}: {
  userOption: ChatUserOption;
  onStartDirect: (userId: number) => void;
  onOpenUserOptionCard: (userOption: ChatUserOption) => void;
}) {
  const description = [userOption.department, `@${userOption.username}`].filter(Boolean).join(' · ');

  return (
    <div className="flex w-full items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
      <button type="button" className="shrink-0" onClick={() => onOpenUserOptionCard(userOption)}>
        <UserAvatar name={userOption.name} avatar={userOption.avatar} className="h-11 w-11 rounded-[16px] border border-slate-200" />
      </button>

      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenUserOptionCard(userOption)}>
        <span className="block truncate text-sm font-semibold text-slate-950">{userOption.name}</span>
        <span className="mt-1 block truncate text-xs text-slate-500">{description || userOption.role}</span>
      </button>

      <div className="flex shrink-0 items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          onClick={() => onStartDirect(userOption.id)}
        >
          私信
        </Button>
      </div>
    </div>
  );
}

function ChatPanel({
  compact,
  user,
  conversation,
  messages,
  draft,
  error,
  sending,
  uploading,
  loadingMessages,
  loadingMoreMessages,
  hasMoreMessages,
  imageInputRef,
  fileInputRef,
  historyRef,
  onBack,
  onDraftChange,
  onKeyDown,
  onSend,
  onUpload,
  onRecall,
  onOpenMembers,
  onOpenDirectUserCard,
  onOpenUserCard,
  onHistoryTop,
}: {
  compact: boolean;
  user?: AppUser;
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  draft: string;
  error: string;
  sending: boolean;
  uploading: boolean;
  loadingMessages: boolean;
  loadingMoreMessages: boolean;
  hasMoreMessages: boolean;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  historyRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onDraftChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onUpload: (file: File | undefined) => void;
  onRecall: (message: ChatMessage) => void;
  onOpenMembers: () => void;
  onOpenDirectUserCard: () => void;
  onOpenUserCard: (member: ChatMember) => void;
  onHistoryTop: () => void;
}) {
  const handleHistoryScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (target.scrollTop < 80) {
      void onHistoryTop();
    }
  };

  const handleMembersTouch = (event: React.PointerEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    if (!compact) return;
    event.preventDefault();
    event.stopPropagation();
    onOpenMembers();
  };

  if (!conversation) {
    return (
      <section className="flex min-h-0 min-w-0 items-center justify-center rounded-[26px] border border-white/70 bg-white p-6 text-center shadow-sm">
        <div>
          <MessageCircle className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <div className="text-sm text-slate-500">从左侧选择一个会话开始聊天</div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'flex min-h-0 min-w-0 flex-col overflow-hidden bg-white',
        compact ? 'h-screen h-[100dvh] max-h-[100dvh] rounded-none border-0 shadow-none' : 'rounded-[26px] border border-white/70 shadow-sm',
      )}
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4 py-3',
          compact && 'px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]',
        )}
      >
        {compact && (
          <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        <button
          type="button"
          className="shrink-0"
          onClick={conversation.type === 'direct' ? onOpenDirectUserCard : onOpenMembers}
        >
          <ConversationAvatar conversation={conversation} />
        </button>

        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={conversation.type === 'direct' ? onOpenDirectUserCard : onOpenMembers}
        >
          <div className="truncate text-base font-semibold text-slate-950">{conversation.title}</div>
          <div className="truncate text-xs text-slate-500">
            {conversation.type === 'group' ? `${conversation.member_count} 位成员` : '私信对话'}
          </div>
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 touch-manipulation rounded-full"
          onClick={onOpenMembers}
          onPointerDown={(event) => {
            if (event.pointerType !== 'mouse') {
              handleMembersTouch(event);
            }
          }}
          onTouchEnd={handleMembersTouch}
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {error && <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">{error}</div>}

      <div
        ref={historyRef}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_top,_#f8fbff,_#eef3f9_58%,_#e8edf5)] px-4 py-4 [-webkit-overflow-scrolling:touch]',
          compact && 'px-3 py-3',
        )}
        onScroll={handleHistoryScroll}
      >
        <div className="flex w-full flex-col gap-4">
          {loadingMoreMessages && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              加载更早消息中...
            </div>
          )}
          {!hasMoreMessages && messages.length > 0 && (
            <div className="text-center text-[11px] text-slate-400">已经到最早的聊天记录了</div>
          )}
          {loadingMessages && (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              消息加载中...
            </div>
          )}

          {messages.map((message) => {
            const sender = conversation.members.find((member) => member.user_id === message.sender_id);
            return (
              <MessageBubble
                key={message.id}
                message={message}
                conversation={conversation}
                mine={message.sender_id === user?.id}
                sender={sender}
                user={user}
                compact={compact}
                onRecall={onRecall}
                onOpenUserCard={onOpenUserCard}
              />
            );
          })}

          {!loadingMessages && !messages.length && (
            <div className="py-16 text-center text-sm text-slate-500">还没有消息，发一条开始吧。</div>
          )}
        </div>
      </div>

      <div
        className={cn(
          'shrink-0 border-t border-slate-100 bg-white px-3 py-3',
          compact && 'bg-[#f7f7f7] px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2',
        )}
      >
        <input
          ref={imageInputRef}
          hidden
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => onUpload(event.target.files?.[0])}
        />
        <input ref={fileInputRef} hidden type="file" onChange={(event) => onUpload(event.target.files?.[0])} />

        {!compact && (
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            {conversation.type === 'group' ? (
              <>
                <AtSign className="h-3.5 w-3.5" />
                可在群里输入 @成员名
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" />
                私信与群聊界面都已统一适配
              </>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('shrink-0 rounded-full', compact && 'h-10 w-10 text-slate-700')}
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('shrink-0 rounded-full', compact && 'h-10 w-10 text-slate-700')}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={compact ? '' : '输入消息，Enter 发送，Shift+Enter 换行'}
            className={cn(
              'min-h-11 min-w-0 flex-1 resize-none rounded-[24px] bg-slate-50 text-base text-slate-950 placeholder:text-slate-400',
              compact
                ? 'max-h-24 min-h-10 rounded-[18px] border-slate-200 bg-white px-3 py-2 leading-6 shadow-inner placeholder:text-transparent'
                : 'max-h-36',
            )}
          />
          <Button
            type="button"
            className={cn(
              'h-11 shrink-0 rounded-full bg-blue-600 px-4 hover:bg-blue-700',
              compact && 'h-10 w-10 bg-[#07c160] px-0 hover:bg-[#06ad56]',
            )}
            onClick={onSend}
            disabled={sending || !draft.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function MessageBubble({
  message,
  conversation,
  mine,
  sender,
  user,
  compact,
  onRecall,
  onOpenUserCard,
}: {
  message: ChatMessage;
  conversation: ChatConversation;
  mine: boolean;
  sender?: ChatMember;
  user?: AppUser;
  compact: boolean;
  onRecall: (message: ChatMessage) => void;
  onOpenUserCard: (member: ChatMember) => void;
}) {
  const recallable = canRecallMessage(message, conversation, user);

  if (message.message_type === 'system') {
    return (
      <div className="flex justify-center px-8">
        <span className="max-w-full rounded-full bg-slate-300/70 px-3 py-1 text-center text-xs leading-relaxed text-slate-600 shadow-sm">
          {message.content || '系统消息'}
        </span>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className={cn('flex w-full items-start gap-3', mine && 'flex-row-reverse')}>
          <button type="button" onClick={() => sender && onOpenUserCard(sender)}>
            <UserAvatar
              name={message.sender_name}
              avatar={sender?.avatar || null}
              className="h-10 w-10 border border-white/70 shadow-sm"
            />
          </button>
          <div className={cn('min-w-0 max-w-[74%]', compact && 'max-w-[82%]')}>
            <div className={cn('mb-1 flex items-center gap-2 text-xs text-slate-500', mine && 'justify-end')}>
              {conversation.type === 'group' && !mine && <span>{message.sender_name}</span>}
              <span>{formatMessageTime(message.created_at)}</span>
            </div>
            <div
              className={cn(
                'min-w-9 rounded-[22px] px-3 py-2 text-sm leading-relaxed shadow-sm',
                mine
                  ? 'rounded-tr-md bg-[#95ec69] text-slate-950'
                  : 'rounded-tl-md bg-white text-slate-950',
                message.recalled === 1 && 'bg-slate-200 text-slate-500',
              )}
            >
              {message.recalled === 1 ? (
                <span className="italic">消息已撤回</span>
              ) : (
                <MessageContent message={message} />
              )}
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem disabled={!recallable} onSelect={() => onRecall(message)}>
          <RotateCcw className="h-4 w-4" />
          撤回消息
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function MessageContent({ message }: { message: ChatMessage }) {
  return (
    <>
      {message.message_type === 'text' && (
        <div className="min-w-0 whitespace-pre-wrap break-words text-slate-950">{message.content || ' '}</div>
      )}
      {message.attachments.map((attachment) =>
        attachment.is_image === 1 ? (
          <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="block">
            <img
              src={attachment.url}
              alt={attachment.original_name}
              className="max-h-80 rounded-2xl border border-white/50 object-contain"
            />
            <div className="mt-1 max-w-64 truncate text-xs opacity-70">{attachment.original_name}</div>
          </a>
        ) : (
          <a
            key={attachment.id}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="flex max-w-72 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2"
          >
            <FileUp className="h-4 w-4 shrink-0" />
            <span className="truncate">{attachment.original_name}</span>
          </a>
        ),
      )}
      {message.message_type !== 'text' && message.content && (
        <div className="mt-1 min-w-0 whitespace-pre-wrap break-words text-slate-950">{message.content}</div>
      )}
    </>
  );
}

function GroupDialog({
  open,
  title,
  users,
  selectedIds,
  memberQuery,
  onOpenChange,
  onTitleChange,
  onMemberQueryChange,
  onToggleUser,
  onStartDirect,
  onCreate,
}: {
  open: boolean;
  title: string;
  users: ChatUserOption[];
  selectedIds: number[];
  memberQuery: string;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onMemberQueryChange: (value: string) => void;
  onToggleUser: (userId: number) => void;
  onStartDirect: (userId: number) => void;
  onCreate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>新建群聊</DialogTitle>
          <DialogDescription>先挑成员，再起个群名，也可以顺手发起私信。</DialogDescription>
        </DialogHeader>
        <Input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="群聊名称，可留空" />
        <MemberSearch value={memberQuery} onChange={onMemberQueryChange} />
        <UserCheckboxList users={users} selectedIds={selectedIds} onToggle={onToggleUser} onStartDirect={onStartDirect} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={onCreate}>
            创建群聊
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersDialog({
  open,
  compact,
  conversation,
  users,
  selectedIds,
  memberQuery,
  currentUserId,
  currentUserDnd,
  canManage,
  renameValue,
  actionLoading,
  onOpenChange,
  onMemberQueryChange,
  onToggleUser,
  onStartDirect,
  onRemove,
  onAdd,
  onOpenUserCard,
  onMention,
  onMute,
  onToggleDnd,
  onRenameValueChange,
  onRename,
  onLeave,
  onDissolve,
}: {
  open: boolean;
  compact: boolean;
  conversation: ChatConversation | null;
  users: ChatUserOption[];
  selectedIds: number[];
  memberQuery: string;
  currentUserId?: number;
  currentUserDnd: boolean;
  canManage: boolean;
  renameValue: string;
  actionLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberQueryChange: (value: string) => void;
  onToggleUser: (userId: number) => void;
  onStartDirect: (userId: number) => void;
  onRemove: (userId: number) => void;
  onAdd: () => void;
  onOpenUserCard: (member: ChatMember) => void;
  onMention: (member: ChatMember) => void;
  onMute: (memberId: number, minutes: number | null) => void;
  onToggleDnd: (checked: boolean) => void;
  onRenameValueChange: (value: string) => void;
  onRename: () => void;
  onLeave: () => void;
  onDissolve: () => void;
}) {
  const isGroup = conversation?.type === 'group';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex gap-0 overflow-hidden p-0',
          compact
            ? 'h-screen h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none border-0'
            : 'h-[88vh] max-h-[88vh] max-w-4xl',
        )}
      >
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
          <DialogHeader
            className={cn(
              'shrink-0 border-b px-6 pb-4 pt-6',
              compact && 'px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)]',
            )}
          >
            <DialogTitle>{isGroup ? '群聊设置' : '聊天资料'}</DialogTitle>
            <DialogDescription>
              {isGroup ? '这里可以查看成员、改群名、禁言、拉人、退群或解散群聊。' : '这里可以查看对方资料并切换当前会话通知。'}
            </DialogDescription>
          </DialogHeader>

          <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5', compact && 'px-4 pb-8 pt-4')}>
            <div className="space-y-5">
              <section className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex items-start gap-4">
                  {conversation && <ConversationAvatar conversation={conversation} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-slate-950">{conversation?.title || '未选择会话'}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {isGroup ? `${conversation?.member_count || 0} 位成员` : '私信聊天'}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <BellOff className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-600">本会话免打扰</span>
                      <div className="flex-1" />
                      <Switch checked={currentUserDnd} onCheckedChange={onToggleDnd} />
                    </div>
                  </div>
                </div>
              </section>

              {isGroup && canManage && (
                <section className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">聊头导航和群资料</div>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <Input
                      value={renameValue}
                      onChange={(event) => onRenameValueChange(event.target.value)}
                      placeholder="修改群聊名称"
                    />
                    <Button type="button" variant="outline" onClick={onRename}>
                      保存群名称
                    </Button>
                  </div>
                </section>
              )}

              <section className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">成员列表</div>
                  {isGroup && canManage && (
                    <Button type="button" variant="outline" size="sm" onClick={onAdd} disabled={selectedIds.length === 0}>
                      <UserPlus className="mr-1 h-4 w-4" />
                      拉人进群
                    </Button>
                  )}
                </div>

                {conversation?.members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isGroup={Boolean(isGroup)}
                    currentUserId={currentUserId}
                    canManage={canManage}
                    onStartDirect={onStartDirect}
                    onRemove={onRemove}
                    onOpenUserCard={onOpenUserCard}
                    onMention={onMention}
                    onMute={onMute}
                  />
                ))}
              </section>

              {isGroup && (
                <section className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">添加成员</div>
                  <MemberSearch value={memberQuery} onChange={onMemberQueryChange} />
                  <UserCheckboxList users={users} selectedIds={selectedIds} onToggle={onToggleUser} onStartDirect={onStartDirect} />
                </section>
              )}

              {isGroup && (
                <section className="grid gap-3 rounded-3xl border border-slate-100 bg-white p-4 md:grid-cols-2">
                  <Button type="button" variant="outline" className="justify-start rounded-2xl" onClick={onLeave} disabled={actionLoading}>
                    <UserMinus className="mr-2 h-4 w-4" />
                    退出群聊
                  </Button>
                  {canManage && (
                    <Button type="button" variant="destructive" className="justify-start rounded-2xl" onClick={onDissolve} disabled={actionLoading}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      解散群聊
                    </Button>
                  )}
                </section>
              )}
            </div>
          </div>

          <DialogFooter
            className={cn(
              'shrink-0 border-t px-6 py-4',
              compact && 'px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3',
            )}
          >
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UserCardDialog({
  userCard,
  onOpenChange,
}: {
  userCard: UserCardState | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(userCard)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>用户资料</DialogTitle>
          <DialogDescription>点击头像即可查看对方基础信息。</DialogDescription>
        </DialogHeader>
        {userCard && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <UserAvatar name={userCard.name} avatar={userCard.avatar || null} className="h-16 w-16 border border-slate-200" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold text-slate-950">{userCard.name}</div>
                <div className="truncate text-sm text-slate-500">@{userCard.username}</div>
                {userCard.department && <div className="mt-2 text-xs text-slate-500">{userCard.department}</div>}
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-slate-100 bg-white p-4 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span>角色</span>
                <span className="font-medium text-slate-900">{userCard.role || '成员'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>免打扰</span>
                <span className="font-medium text-slate-900">{userCard.doNotDisturb === 1 ? '已开启' : '未开启'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>禁言状态</span>
                <span className="font-medium text-slate-900">{formatMuteText(userCard.mutedUntil)}</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MemberSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="搜索成员" className="pl-9" />
    </div>
  );
}

function UserCheckboxList({
  users,
  selectedIds,
  onToggle,
  onStartDirect,
}: {
  users: ChatUserOption[];
  selectedIds: number[];
  onToggle: (userId: number) => void;
  onStartDirect: (userId: number) => void;
}) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-2xl border">
      <div className="space-y-1 p-2">
        {users.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-slate-50">
            <Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => onToggle(item.id)} />
            <UserAvatar name={item.name} avatar={item.avatar} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">{item.name}</span>
              <span className="block truncate text-xs text-slate-500">
                @{item.username}
                {item.department ? ` · ${item.department}` : ''}
              </span>
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => onStartDirect(item.id)}>
              私信
            </Button>
          </div>
        ))}
        {!users.length && <div className="px-3 py-6 text-center text-sm text-slate-500">没有可选择的用户</div>}
      </div>
    </div>
  );
}

function MemberRow({
  member,
  isGroup,
  currentUserId,
  canManage,
  onStartDirect,
  onRemove,
  onOpenUserCard,
  onMention,
  onMute,
}: {
  member: ChatMember;
  isGroup: boolean;
  currentUserId?: number;
  canManage: boolean;
  onStartDirect: (userId: number) => void;
  onRemove: (userId: number) => void;
  onOpenUserCard: (member: ChatMember) => void;
  onMention: (member: ChatMember) => void;
  onMute: (memberId: number, minutes: number | null) => void;
}) {
  const isSelf = member.user_id === currentUserId;
  const isOwner = member.role === 'owner';
  const muted = formatMuteText(member.muted_until);

  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onOpenUserCard(member)}>
          <UserAvatar name={member.name} avatar={member.avatar} className="border border-slate-200" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-950">{member.name}</span>
            {isOwner && (
              <Badge variant="secondary" className="rounded-full text-[10px]">
                <Crown className="mr-1 h-3 w-3" />
                群主
              </Badge>
            )}
            {isSelf && <span className="text-xs text-slate-400">我</span>}
          </div>
          <div className="truncate text-xs text-slate-500">
            @{member.username}
            {isGroup ? ` · ${muted}` : ''}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!isSelf && (
          <Button type="button" variant="outline" size="sm" onClick={() => onStartDirect(member.user_id)}>
            私信
          </Button>
        )}
        {isGroup && !isSelf && (
          <Button type="button" variant="outline" size="sm" onClick={() => onMention(member)}>
            <AtSign className="mr-1 h-3.5 w-3.5" />
            @TA
          </Button>
        )}
        {canManage && !isSelf && !isOwner && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => onMute(member.user_id, 10)}>
              <ShieldBan className="mr-1 h-3.5 w-3.5" />
              禁言10分
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onMute(member.user_id, 60)}>
              禁言1小时
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onMute(member.user_id, null)}>
              取消禁言
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => onRemove(member.user_id)}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              踢出群聊
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ConversationAvatar({ conversation }: { conversation: ChatConversation }) {
  if (conversation.type === 'group') {
    return (
      <Avatar className="h-12 w-12 rounded-[18px]">
        <AvatarFallback className="rounded-[18px] bg-blue-600 text-white">
          <Users className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>
    );
  }
  return <UserAvatar name={conversation.title} avatar={conversation.avatar} className="h-12 w-12 rounded-[18px]" />;
}

function UserAvatar({
  name,
  avatar,
  className,
}: {
  name?: string | null;
  avatar?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn('h-10 w-10', className)}>
      <AvatarImage src={avatar || undefined} alt={name || '头像'} />
      <AvatarFallback className="bg-slate-200 text-slate-700">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
