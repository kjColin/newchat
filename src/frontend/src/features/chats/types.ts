import type { SearchUser } from '../users/types';

export type Message = {
  id: string;
  clientId?: string | null;
  content: string;
  type: string;
  senderId: string;
  conversationId: string;
  replyToId?: string | null;
  forwardFromId?: string | null;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  sender?: {
    id: string;
    username: string;
    avatar?: string | null;
  };
  replyTo?: MessageReference | null;
  forwardFrom?: MessageReference | null;
  attachments?: Attachment[];
  reactions?: MessageReaction[];
};

export type Attachment = {
  id: string;
  messageId?: string | null;
  uploaderId: string;
  kind: 'image' | 'video' | 'audio' | 'file' | string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string | null;
  createdAt: string;
};

export type MessageReference = {
  id: string;
  content: string;
  senderId: string;
  deletedAt?: string | null;
  sender?: {
    id: string;
    username: string;
    avatar?: string | null;
  };
};

export type MessageReaction = {
  id: string;
  emoji: string;
  userId: string;
  messageId: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
  };
};

export type Conversation = {
  id: string;
  conversationId: string;
  groupId?: string;
  type: 'direct' | 'group';
  name: string;
  avatar?: string | null;
  memberCount: number;
  role?: string;
  lastMessage?: Message | null;
  user?: SearchUser | null;
  unreadCount?: number;
  lastReadAt?: string | null;
  pinnedAt?: string | null;
  mutedUntil?: string | null;
  archivedAt?: string | null;
  lastActivityAt?: string;
};

export type MessagesResponse = {
  messages: Message[];
  hasMore: boolean;
};

export type MessageSearchResponse = {
  messages: Message[];
};

export type GroupMember = {
  id: string;
  userId: string;
  groupId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  user: SearchUser;
};
