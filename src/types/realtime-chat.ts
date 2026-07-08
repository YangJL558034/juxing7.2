export type ChatConversationType = 'group' | 'direct';
export type ChatMessageType = 'text' | 'image' | 'file' | 'system';

export interface ChatMember {
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

export interface ChatAttachment {
  id: number;
  message_id: number;
  conversation_id: number;
  file_name: string;
  original_name: string;
  mime_type: string;
  file_ext: string | null;
  size: number;
  compressed_size: number;
  is_image: 0 | 1;
  created_at: string;
  url: string;
}

export interface ChatMessage {
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
  attachments: ChatAttachment[];
}

export interface ChatMessagePage {
  messages: ChatMessage[];
  has_more: boolean;
  next_before_id: number | null;
}

export interface ChatConversation {
  id: number;
  title: string;
  type: ChatConversationType;
  created_by: number;
  created_at: string;
  updated_at: string;
  member_count: number;
  unread_count: number;
  avatar: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  members: ChatMember[];
}

export interface ChatUserOption {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
  role: string;
  department: string | null;
}
