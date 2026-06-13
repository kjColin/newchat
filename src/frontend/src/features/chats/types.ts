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
  uploader?: {
    id: string;
    username: string;
    avatar?: string | null;
  };
  message?: {
    id: string;
    content: string;
    type: string;
    conversationId: string;
    createdAt: string;
    sender?: {
      id: string;
      username: string;
      avatar?: string | null;
    };
  } | null;
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
  channelId?: string;
  type: 'direct' | 'group' | 'channel';
  name: string;
  avatar?: string | null;
  announcement?: string | null;
  description?: string | null;
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

export type AttachmentsResponse = {
  attachments: Attachment[];
  hasMore: boolean;
};

export type LinkPreview = {
  id: string;
  url: string;
  title: string;
  messageId: string;
  conversationId: string;
  content: string;
  createdAt: string;
  sender?: {
    id: string;
    username: string;
    avatar?: string | null;
  };
};

export type LinksResponse = {
  links: LinkPreview[];
  hasMore: boolean;
};

export type MessageSearchResponse = {
  messages: Message[];
};

export type PinnedMessage = {
  conversationId: string;
  messageId: string;
  pinnedById: string;
  pinnedAt: string;
  pinnedBy?: {
    id: string;
    username: string;
    avatar?: string | null;
  };
  message: Message;
};

export type PinnedMessagesResponse = {
  pinnedMessages: PinnedMessage[];
};

export type GroupMember = {
  id: string;
  userId: string;
  groupId?: string;
  channelId?: string;
  role: 'owner' | 'admin' | 'member' | 'subscriber';
  joinedAt: string;
  user: SearchUser;
};

export type ChannelDiscoveryItem = {
  id: string;
  channelId: string;
  conversationId: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
  memberCount: number;
  isSubscribed: boolean;
  role?: 'owner' | 'admin' | 'subscriber' | null;
};

export type GroupDiscoveryItem = {
  id: string;
  groupId: string;
  conversationId: string;
  name: string;
  announcement?: string | null;
  avatar?: string | null;
  memberCount: number;
  isJoined: boolean;
  role?: 'owner' | 'admin' | 'member' | null;
};

export type InviteLink = {
  id: string;
  groupId: string;
  code: string;
  createdById: string;
  expiresAt?: string | null;
  maxUses?: number | null;
  usedCount: number;
  revokedAt?: string | null;
  createdAt: string;
  createdBy?: {
    id: string;
    username: string;
  };
};

export type InvitePreview = {
  code: string;
  group: {
    id: string;
    conversationId: string;
    name: string;
    avatar?: string | null;
    memberCount: number;
  };
};
