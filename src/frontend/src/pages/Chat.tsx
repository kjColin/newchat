import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, MessageCircle, Pin, X } from 'lucide-react';
import { authStore } from '../features/auth/auth-store';
import type { User } from '../features/auth/types';
import {
  createChannel,
  createDirectConversation,
  createGroup,
  createGroupInviteLink,
  deleteMessage,
  discoverChannels,
  discoverGroups,
  editMessage,
  addGroupMembers,
  forwardMessage,
  getChannelMembers,
  getConversations,
  getConversationAttachments,
  getConversationLinks,
  getGroupInviteLinks,
  getGroupMembers,
  getMessages,
  getPinnedMessages,
  joinGroupByInvite,
  joinPublicGroup,
  markConversationRead,
  pinMessage,
  removeGroupMember,
  revokeGroupInviteLink,
  searchMessages,
  sendMessage,
  subscribeChannel,
  toggleReaction,
  unsubscribeChannel,
  updateConversationSettings,
  updateGroup,
  unpinMessage,
  uploadFile,
} from '../features/chats/api';
import { ChatHeader } from '../features/chats/components/ChatHeader';
import { ConversationDetails } from '../features/chats/components/ConversationDetails';
import { ConversationList } from '../features/chats/components/ConversationList';
import { MessageComposer } from '../features/chats/components/MessageComposer';
import { MessageList } from '../features/chats/components/MessageList';
import { connectChatSocket, joinConversation, startTyping, stopTyping } from '../features/chats/socket';
import type { ChatSocket } from '../features/chats/socket';
import type { Attachment, ChannelDiscoveryItem, Conversation, GroupDiscoveryItem, GroupMember, InviteLink, LinkPreview, Message, PinnedMessage } from '../features/chats/types';
import { CreateChannelModal } from '../features/channels/components/CreateChannelModal';
import { CreateGroupModal } from '../features/groups/components/CreateGroupModal';
import { ProfileModal } from '../features/users/components/ProfileModal';
import {
  addContact,
  blockUser,
  getBlockedUsers,
  getContacts,
  getCurrentUser,
  removeContact,
  searchUsers,
  unblockUser,
  updateCurrentUser,
} from '../features/users/api';
import type { BlockedUserEntry, ContactEntry, SearchUser } from '../features/users/types';
import { getBrowserNotificationState, requestBrowserNotificationPermission, showBrowserNotification, subscribeToWebPush } from '../features/notifications/browser-notifications';
import { NotificationMenu } from '../features/notifications/components/NotificationMenu';
import type { BrowserNotificationState, NotificationItem } from '../features/notifications/types';
import {
  clearNotifications as clearStoredNotifications,
  getNotifications,
  getPushPublicKey,
  markAllNotificationsRead as markAllStoredNotificationsRead,
  markConversationNotificationsRead,
  markNotificationRead,
  savePushSubscription,
} from '../features/notifications/api';
import './Chat.css';

function upsertConversation(list: Conversation[], conversation: Conversation) {
  const exists = list.some(item => item.id === conversation.id);
  if (exists) return list.map(item => item.id === conversation.id ? conversation : item);
  return [conversation, ...list];
}

function sortConversations(list: Conversation[]) {
  return [...list].sort((a, b) => {
    if (a.pinnedAt && !b.pinnedAt) return -1;
    if (!a.pinnedAt && b.pinnedAt) return 1;
    return new Date(b.lastActivityAt || b.lastMessage?.createdAt || 0).getTime() -
      new Date(a.lastActivityAt || a.lastMessage?.createdAt || 0).getTime();
  });
}

function createClientId() {
  const random = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${random}`;
}

function isNearBottom(element: HTMLElement | null) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
}

function parseInviteCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed, window.location.origin);
    const inviteParam = url.searchParams.get('invite');
    if (inviteParam) return inviteParam.trim();

    const segments = url.pathname.split('/').filter(Boolean);
    const inviteSegment = segments.findIndex(segment => segment === 'invite' || segment === 'invites');
    if (inviteSegment >= 0 && segments[inviteSegment + 1]) {
      return decodeURIComponent(segments[inviteSegment + 1]);
    }

    if (segments.length > 0 && url.pathname !== '/chat') {
      return decodeURIComponent(segments[segments.length - 1]);
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

function formatNotificationBody(message: Message) {
  if (message.content.trim()) return message.content.trim();
  const attachment = message.attachments?.[0];
  if (attachment) return attachment.fileName;
  return 'New message';
}

export function ChatPage() {
  const navigate = useNavigate();
  const initialUser = useMemo(() => authStore.getUser(), []) as User | null;
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [socket, setSocket] = useState<ChatSocket | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [pinLoading, setPinLoading] = useState(false);
  const [unreadMarkerId, setUnreadMarkerId] = useState<string | null>(null);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [sending, setSending] = useState(false);
  const [sidebarError, setSidebarError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState<Message[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [groupResults, setGroupResults] = useState<GroupDiscoveryItem[]>([]);
  const [channelResults, setChannelResults] = useState<ChannelDiscoveryItem[]>([]);
  const [discoveryActionLoading, setDiscoveryActionLoading] = useState('');
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserEntry[]>([]);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<SearchUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<SearchUser[]>([]);
  const [createError, setCreateError] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [channelError, setChannelError] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsNotice, setDetailsNotice] = useState('');
  const [mediaAttachments, setMediaAttachments] = useState<Attachment[]>([]);
  const [fileAttachments, setFileAttachments] = useState<Attachment[]>([]);
  const [linkPreviews, setLinkPreviews] = useState<LinkPreview[]>([]);
  const [linkFilter, setLinkFilter] = useState<'all' | 'contact' | 'me'>('all');
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<SearchUser[]>([]);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [joiningInvite, setJoiningInvite] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileSearchable, setProfileSearchable] = useState(true);
  const [profileAllowDirectMessages, setProfileAllowDirectMessages] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [browserNotificationState, setBrowserNotificationState] = useState<BrowserNotificationState>(() => getBrowserNotificationState());
  const activeConversationId = useRef<string | null>(null);
  const handledInviteCode = useRef<string | null>(null);
  const typingTimer = useRef<number | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const selectConversationRef = useRef<(conversation: Conversation) => Promise<void>>();
  const pinnedMessageIds = useMemo(() => new Set(pinnedMessages.map(item => item.messageId)), [pinnedMessages]);
  const unreadNotificationCount = useMemo(
    () => notifications.filter(notification => !notification.read).length,
    [notifications],
  );
  const activeDirectBlocked = Boolean(activeConversation?.type === 'direct' && activeConversation.user?.isBlocked);
  const activeChannelReadOnly = Boolean(
    activeConversation?.type === 'channel' &&
    !['owner', 'admin'].includes(activeConversation.role || ''),
  );
  const syncSearchUser = useCallback((userId: string, updates: Partial<SearchUser>) => {
    setSearchResults(prev => prev.map(user => user.id === userId ? { ...user, ...updates } : user));
    setGroupSearchResults(prev => prev.map(user => user.id === userId ? { ...user, ...updates } : user));
    setMemberSearchResults(prev => prev.map(user => user.id === userId ? { ...user, ...updates } : user));
  }, []);

  const selectConversation = useCallback(async (conversation: Conversation) => {
    setActiveConversation(conversation);
    setGroupNameDraft(conversation.name);
    setAnnouncementDraft(conversation.announcement || '');
    setReplyToMessage(null);
    setPendingAttachments([]);
    setMessageSearch('');
    setMessageSearchResults([]);
    setHasMoreMessages(false);
    setPinnedMessages([]);
    setUnreadMarkerId(null);
    setShowJumpLatest(false);
    setDetailsOpen(false);
    setMobileConversationOpen(true);
    setNotificationsOpen(false);
    setNotifications(prev => prev.map(notification =>
      notification.conversationId === conversation.id ? { ...notification, read: true } : notification
    ));
    markConversationNotificationsRead(conversation.id).catch(() => undefined);
    setLoadingMessages(true);
    setMessageError('');
    joinConversation(socket, conversation.id);

    try {
      const data = await getMessages(conversation.id);
      setMessages(data.messages);
      setHasMoreMessages(data.hasMore);
      getPinnedMessages(conversation.id)
        .then(setPinnedMessages)
        .catch(() => setPinnedMessages([]));
      const marker = conversation.lastReadAt
        ? data.messages.find(message =>
            message.senderId !== currentUser.id &&
            new Date(message.createdAt) > new Date(conversation.lastReadAt as string)
          )
        : null;
      setUnreadMarkerId(marker?.id || null);
      setShowJumpLatest(Boolean(marker));
      const read = await markConversationRead(conversation.id).catch(() => null);
      setActiveConversation(prev =>
        prev?.id === conversation.id ? { ...prev, unreadCount: 0, lastReadAt: read?.lastReadAt || prev.lastReadAt } : prev
      );
      setConversations(prev => prev.map(item =>
        item.id === conversation.id ? { ...item, unreadCount: 0, lastReadAt: read?.lastReadAt || item.lastReadAt } : item
      ));
    } catch (error: any) {
      setMessages([]);
      setHasMoreMessages(false);
      setUnreadMarkerId(null);
      setShowJumpLatest(false);
      setMessageError(error.response?.data?.message || 'Could not load messages');
    } finally {
      setLoadingMessages(false);
    }
  }, [socket]);

  const showMessageNotification = useCallback((message: Message) => {
    const conversation = conversationsRef.current.find(item => item.id === message.conversationId);
    const title = conversation?.name || message.sender?.username || 'New message';
    const body = formatNotificationBody(message);

    showBrowserNotification(title, body, () => {
      const target = conversationsRef.current.find(conversation => conversation.id === message.conversationId);
      if (target) {
        selectConversationRef.current?.(target);
      }
    });
  }, []);

  const joinInviteCode = useCallback(async (value: string, options: { clearUrl?: boolean } = {}) => {
    const code = parseInviteCode(value);
    if (!code) {
      setSidebarError('Invite code is required');
      return;
    }

    setJoiningInvite(true);
    setSidebarError('');
    try {
      const conversation = await joinGroupByInvite(code);
      setConversations(prev => sortConversations(upsertConversation(prev, conversation)));
      setInviteInput('');
      await selectConversation(conversation);
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not join invite');
    } finally {
      setJoiningInvite(false);
      if (options.clearUrl) {
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    }
  }, [selectConversation]);

  useEffect(() => {
    if (!currentUser) {
      authStore.clear();
      navigate('/login', { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const token = authStore.getToken();
    if (!token) return;

    let cancelled = false;
    getCurrentUser()
      .then(user => {
        if (cancelled) return;
        authStore.setSession(token, user);
        setCurrentUser(user);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    activeConversationId.current = activeConversation?.id || null;
  }, [activeConversation?.id]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectConversationRef.current = selectConversation;
  }, [selectConversation]);

  useEffect(() => {
    if (socket && activeConversation?.id) {
      joinConversation(socket, activeConversation.id);
    }
  }, [socket, activeConversation?.id]);

  useEffect(() => {
    const token = authStore.getToken();
    if (!token) return;

    const ws = connectChatSocket(token);
    ws.on('message', message => {
      setConversations(prev => sortConversations(prev.map(conversation => {
        if (conversation.id !== message.conversationId) return conversation;

        const isActive = activeConversationId.current === message.conversationId;
        const isOwn = message.senderId === currentUser?.id;
        return {
          ...conversation,
          lastMessage: message,
          lastActivityAt: message.createdAt,
          unreadCount: isActive || isOwn ? 0 : (conversation.unreadCount || 0) + 1,
        };
      })));

      if (activeConversationId.current === message.conversationId) {
        const wasNearBottom = isNearBottom(messageListRef.current);
        setMessages(prev => prev.some(existing => existing.id === message.id) ? prev : [...prev, message]);
        setActiveConversation(prev =>
          prev?.id === message.conversationId
            ? { ...prev, lastMessage: message, lastActivityAt: message.createdAt, unreadCount: 0 }
            : prev
        );
        if (!wasNearBottom && message.senderId !== currentUser?.id) {
          setShowJumpLatest(true);
        }
        if (message.senderId !== currentUser?.id) {
          markConversationRead(message.conversationId).catch(() => undefined);
        }
      } else if (message.senderId !== currentUser?.id) {
        showMessageNotification(message);
      }
    });
    ws.on('notification', notification => {
      const nextNotification = activeConversationId.current === notification.conversationId
        ? { ...notification, read: true }
        : notification;
      if (nextNotification.read) {
        markConversationNotificationsRead(notification.conversationId).catch(() => undefined);
      }
      setNotifications(prev => {
        const next = [nextNotification, ...prev.filter(item => item.id !== notification.id)];
        return next.slice(0, 30);
      });
    });
    ws.on('message:updated', message => {
      setMessages(prev => prev.map(item => item.id === message.id ? message : item));
      setConversations(prev => prev.map(conversation =>
        conversation.lastMessage?.id === message.id ? { ...conversation, lastMessage: message } : conversation
      ));
    });
    ws.on('message:deleted', message => {
      setMessages(prev => prev.map(item => item.id === message.id ? message : item));
      setConversations(prev => prev.map(conversation =>
        conversation.lastMessage?.id === message.id ? { ...conversation, lastMessage: message } : conversation
      ));
    });
    ws.on('message:reaction', message => {
      setMessages(prev => prev.map(item => item.id === message.id ? message : item));
    });
    ws.on('message:read', payload => {
      setConversations(prev => prev.map(conversation =>
        conversation.id === payload.conversationId && payload.userId === currentUser?.id
          ? { ...conversation, unreadCount: 0, lastReadAt: payload.lastReadAt }
          : conversation
      ));
    });
    ws.on('message:pinned', payload => {
      if (activeConversationId.current === payload.conversationId) {
        setPinnedMessages(payload.pinnedMessages);
      }
    });
    ws.on('typing', payload => {
      setTypingUsers(prev => {
        const names = new Set(prev[payload.conversationId] || []);
        if (payload.isTyping) names.add(payload.username);
        else names.delete(payload.username);
        return { ...prev, [payload.conversationId]: Array.from(names) };
      });

      if (payload.isTyping) {
        window.setTimeout(() => {
          setTypingUsers(prev => ({
            ...prev,
            [payload.conversationId]: (prev[payload.conversationId] || []).filter(name => name !== payload.username),
          }));
        }, 3500);
      }
    });
    ws.on('presence:update', payload => {
      setConversations(prev => prev.map(conversation => {
        if (conversation.user?.id !== payload.userId) return conversation;
        return {
          ...conversation,
          user: { ...conversation.user, status: payload.status, lastSeen: payload.lastSeen },
        };
      }));
    });

    setSocket(ws);
    return () => {
      ws.disconnect();
    };
  }, [showMessageNotification, currentUser?.id]);

  useEffect(() => {
    async function load() {
      setLoadingConversations(true);
      setSidebarError('');
      try {
        const loaded = await getConversations();
        setConversations(prev => sortConversations(loaded.reduce(upsertConversation, prev)));
      } catch (error: any) {
        setSidebarError(error.response?.data?.message || 'Could not load chats');
      } finally {
        setLoadingConversations(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    async function loadRelationships() {
      try {
        const [nextContacts, nextBlocked] = await Promise.all([
          getContacts(),
          getBlockedUsers(),
        ]);
        setContacts(nextContacts);
        setBlockedUsers(nextBlocked);
      } catch {
        setContacts([]);
        setBlockedUsers([]);
      }
    }

    loadRelationships();
  }, []);

  useEffect(() => {
    getNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('invite');
    if (!code || handledInviteCode.current === code) return;

    handledInviteCode.current = code;
    joinInviteCode(code, { clearUrl: true });
  }, [joinInviteCode]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const query = search.trim();
        if (!query) {
          setSearchResults([]);
          setGroupResults([]);
          setChannelResults([]);
          return;
        }

        const [nextUsers, nextGroups, nextChannels] = await Promise.all([
          searchUsers(query),
          discoverGroups(query),
          discoverChannels(query),
        ]);
        setSearchResults(nextUsers);
        setGroupResults(nextGroups);
        setChannelResults(nextChannels);
      } catch {
        setSearchResults([]);
        setGroupResults([]);
        setChannelResults([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setGroupSearchResults(await searchUsers(groupSearch));
      } catch {
        setGroupSearchResults([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [groupSearch]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setMemberSearchResults(await searchUsers(memberSearch));
      } catch {
        setMemberSearchResults([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [memberSearch]);

  useEffect(() => {
    if (!loadingEarlier && isNearBottom(messageListRef.current)) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, loadingEarlier]);

  if (!currentUser) return null;

  const handleSend = async () => {
    const content = draft.trim();
    if (!activeConversation || (!content && pendingAttachments.length === 0)) return;

    setSending(true);
    setMessageError('');
    try {
      if (editingMessage) {
        const message = await editMessage(editingMessage.id, content);
        setMessages(prev => prev.map(existing => existing.id === message.id ? message : existing));
        setConversations(prev => prev.map(conversation =>
          conversation.lastMessage?.id === message.id ? { ...conversation, lastMessage: message } : conversation
        ));
        setEditingMessage(null);
      } else {
        const hasImage = pendingAttachments.some(attachment => attachment.kind === 'image');
        const message = await sendMessage(activeConversation.id, content, {
          clientId: createClientId(),
          replyToId: replyToMessage?.id,
          attachmentIds: pendingAttachments.map(attachment => attachment.id),
          type: pendingAttachments.length > 0 ? (hasImage ? 'image' : 'file') : 'text',
        });
        setMessages(prev => prev.some(existing => existing.id === message.id) ? prev : [...prev, message]);
        setConversations(prev => sortConversations(prev.map(conversation =>
          conversation.id === message.conversationId
            ? { ...conversation, lastMessage: message, unreadCount: 0, lastActivityAt: message.createdAt }
            : conversation
        )));
        setActiveConversation(prev =>
          prev?.id === message.conversationId
            ? { ...prev, lastMessage: message, unreadCount: 0, lastActivityAt: message.createdAt }
            : prev
        );
        setReplyToMessage(null);
        setPendingAttachments([]);
      }
      setDraft('');
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!activeConversation || editingMessage) return;

    startTyping(socket, activeConversation.id);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      stopTyping(socket, activeConversation.id);
    }, 1200);
  };

  const handleEdit = (message: Message) => {
    setEditingMessage(message);
    setReplyToMessage(null);
    setPendingAttachments([]);
    setDraft(message.content);
  };

  const handleReply = (message: Message) => {
    setEditingMessage(null);
    setReplyToMessage(message);
    setPendingAttachments([]);
    setDraft('');
  };

  const handleSelectFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setMessageError('');
    setSending(true);
    try {
      const nextAttachments = await Promise.all(Array.from(files).slice(0, 10).map(file => uploadFile(file)));
      setPendingAttachments(prev => [...prev, ...nextAttachments].slice(0, 10));
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not upload file');
    } finally {
      setSending(false);
    }
  };

  const removePendingAttachment = (attachmentId: string) => {
    setPendingAttachments(prev => prev.filter(attachment => attachment.id !== attachmentId));
  };

  const handleForward = async (message: Message) => {
    if (!activeConversation) return;
    setMessageError('');
    try {
      const forwarded = await forwardMessage(message.id, activeConversation.id, createClientId());
      setMessages(prev => prev.some(existing => existing.id === forwarded.id) ? prev : [...prev, forwarded]);
      setConversations(prev => sortConversations(prev.map(conversation =>
        conversation.id === forwarded.conversationId
          ? { ...conversation, lastMessage: forwarded, unreadCount: 0, lastActivityAt: forwarded.createdAt }
          : conversation
      )));
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not forward message');
    }
  };

  const handleTogglePin = async (message: Message) => {
    if (!activeConversation || pinLoading) return;
    setPinLoading(true);
    setMessageError('');
    try {
      const response = pinnedMessageIds.has(message.id)
        ? await unpinMessage(activeConversation.id, message.id)
        : await pinMessage(message.id);
      setPinnedMessages(response.pinnedMessages);
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not update pinned message');
    } finally {
      setPinLoading(false);
    }
  };

  const handleDelete = async (message: Message) => {
    setMessageError('');
    try {
      const deleted = await deleteMessage(message.id);
      setMessages(prev => prev.map(item => item.id === deleted.id ? deleted : item));
      setConversations(prev => prev.map(conversation =>
        conversation.lastMessage?.id === deleted.id ? { ...conversation, lastMessage: deleted } : conversation
      ));
      if (editingMessage?.id === message.id) {
        setEditingMessage(null);
        setDraft('');
      }
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not delete message');
    }
  };

  const handleReact = async (message: Message, emoji: string) => {
    try {
      const updated = await toggleReaction(message.id, emoji);
      setMessages(prev => prev.map(item => item.id === updated.id ? updated : item));
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not update reaction');
    }
  };

  const handleMessageSearch = async (value: string) => {
    setMessageSearch(value);
    if (!activeConversation || value.trim().length < 2) {
      setMessageSearchResults([]);
      return;
    }

    setSearchingMessages(true);
    try {
      const data = await searchMessages(activeConversation.id, value.trim());
      setMessageSearchResults(data.messages);
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not search messages');
      setMessageSearchResults([]);
    } finally {
      setSearchingMessages(false);
    }
  };

  const loadEarlierMessages = async () => {
    if (!activeConversation || messages.length === 0 || loadingEarlier || !hasMoreMessages) return;

    const first = messages[0];
    const list = messageListRef.current;
    const previousHeight = list?.scrollHeight || 0;
    setLoadingEarlier(true);
    setMessageError('');

    try {
      const data = await getMessages(activeConversation.id, {
        beforeCreatedAt: first.createdAt,
        beforeId: first.id,
      });
      setMessages(prev => {
        const existing = new Set(prev.map(message => message.id));
        const older = data.messages.filter(message => !existing.has(message.id));
        return [...older, ...prev];
      });
      setHasMoreMessages(data.hasMore);

      window.setTimeout(() => {
        if (!list) return;
        list.scrollTop = list.scrollHeight - previousHeight + list.scrollTop;
      }, 0);
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not load earlier messages');
    } finally {
      setLoadingEarlier(false);
    }
  };

  const handleMessageScroll = () => {
    const nearBottom = isNearBottom(messageListRef.current);
    setShowJumpLatest(!nearBottom);
    if (nearBottom) {
      setUnreadMarkerId(null);
    }
  };

  const jumpToLatest = async () => {
    if (!activeConversation) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowJumpLatest(false);
    setUnreadMarkerId(null);
    const read = await markConversationRead(activeConversation.id).catch(() => null);
    setActiveConversation(prev =>
      prev?.id === activeConversation.id ? { ...prev, unreadCount: 0, lastReadAt: read?.lastReadAt || prev.lastReadAt } : prev
    );
    setConversations(prev => prev.map(item =>
      item.id === activeConversation.id ? { ...item, unreadCount: 0, lastReadAt: read?.lastReadAt || item.lastReadAt } : item
    ));
  };

  const jumpToSearchResult = (message: Message) => {
    setMessageSearch('');
    setMessageSearchResults([]);
    const found = messages.some(item => item.id === message.id);
    if (!found) {
      setMessages(prev => [...prev, message].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ));
    }

    window.setTimeout(() => {
      document.getElementById(`message-${message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const jumpToPinnedMessage = (pinned: PinnedMessage) => {
    const message = pinned.message;
    const found = messages.some(item => item.id === message.id);
    if (!found) {
      setMessages(prev => [...prev, message].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ));
    }

    window.setTimeout(() => {
      document.getElementById(`message-${message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleStartDirect = async (user: SearchUser) => {
    if (user.isBlocked) return;
    setSidebarError('');
    try {
      const conversation = await createDirectConversation(user.id);
      setConversations(prev => sortConversations(upsertConversation(prev, conversation)));
      setSearch('');
      setSearchResults([]);
      await selectConversation(conversation);
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not start chat');
    }
  };

  const handleAddContact = async (user: SearchUser) => {
    setSidebarError('');
    try {
      const nextContacts = await addContact(user.id);
      setContacts(nextContacts);
      syncSearchUser(user.id, { isContact: true, isBlocked: false });
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not add contact');
    }
  };

  const handleRemoveContact = async (user: SearchUser) => {
    setSidebarError('');
    try {
      const nextContacts = await removeContact(user.id);
      setContacts(nextContacts);
      syncSearchUser(user.id, { isContact: false });
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not remove contact');
    }
  };

  const handleBlockUser = async (user: SearchUser) => {
    setSidebarError('');
    try {
      const [nextBlocked, nextContacts] = await Promise.all([
        blockUser(user.id),
        getContacts(),
      ]);
      setBlockedUsers(nextBlocked);
      setContacts(nextContacts);
      syncSearchUser(user.id, { isContact: false, isBlocked: true });
      setConversations(prev => prev.map(conversation =>
        conversation.user?.id === user.id
          ? { ...conversation, user: { ...conversation.user, isContact: false, isBlocked: true } }
          : conversation
      ));
      setActiveConversation(prev =>
        prev?.user?.id === user.id
          ? { ...prev, user: { ...prev.user, isContact: false, isBlocked: true } }
          : prev
      );
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not block user');
    }
  };

  const handleUnblockUser = async (user: SearchUser) => {
    setSidebarError('');
    try {
      const nextBlocked = await unblockUser(user.id);
      setBlockedUsers(nextBlocked);
      syncSearchUser(user.id, { isBlocked: false });
      setConversations(prev => prev.map(conversation =>
        conversation.user?.id === user.id
          ? { ...conversation, user: { ...conversation.user, isBlocked: false } }
          : conversation
      ));
      setActiveConversation(prev =>
        prev?.user?.id === user.id
          ? { ...prev, user: { ...prev.user, isBlocked: false } }
          : prev
      );
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not unblock user');
    }
  };

  const toggleMember = (user: SearchUser) => {
    setSelectedMembers(prev =>
      prev.some(member => member.id === user.id)
        ? prev.filter(member => member.id !== user.id)
        : [...prev, user]
    );
  };

  const handleCreateGroup = async () => {
    setCreatingGroup(true);
    setCreateError('');
    try {
      const conversation = await createGroup(groupName.trim(), selectedMembers.map(member => member.id));
      setConversations(prev => sortConversations(upsertConversation(prev, conversation)));
      setCreateGroupOpen(false);
      setGroupName('');
      setGroupSearch('');
      setGroupSearchResults([]);
      setSelectedMembers([]);
      await selectConversation(conversation);
    } catch (error: any) {
      setCreateError(error.response?.data?.message || 'Could not create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleCreateChannel = async () => {
    setCreatingChannel(true);
    setChannelError('');
    try {
      const conversation = await createChannel(channelName.trim(), channelDescription.trim());
      setConversations(prev => sortConversations(upsertConversation(prev, conversation)));
      setCreateChannelOpen(false);
      setChannelName('');
      setChannelDescription('');
      await selectConversation(conversation);
    } catch (error: any) {
      setChannelError(error.response?.data?.message || 'Could not create channel');
    } finally {
      setCreatingChannel(false);
    }
  };

  const handleSubscribeChannel = async (channel: ChannelDiscoveryItem) => {
    setDiscoveryActionLoading(channel.conversationId);
    setSidebarError('');
    try {
      const conversation = await subscribeChannel(channel.conversationId);
      setConversations(prev => sortConversations(upsertConversation(prev, conversation)));
      setChannelResults(prev => prev.map(item =>
        item.conversationId === channel.conversationId
          ? { ...item, isSubscribed: true, role: conversation.role as ChannelDiscoveryItem['role'], memberCount: conversation.memberCount }
          : item
      ));
      await selectConversation(conversation);
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not subscribe to channel');
    } finally {
      setDiscoveryActionLoading('');
    }
  };

  const handleUnsubscribeChannel = async (channel: ChannelDiscoveryItem) => {
    setDiscoveryActionLoading(channel.conversationId);
    setSidebarError('');
    try {
      await unsubscribeChannel(channel.conversationId);
      setConversations(prev => prev.filter(conversation => conversation.id !== channel.conversationId));
      setChannelResults(prev => prev.map(item =>
        item.conversationId === channel.conversationId
          ? { ...item, isSubscribed: false, role: null, memberCount: Math.max(0, item.memberCount - 1) }
          : item
      ));
      if (activeConversation?.id === channel.conversationId) {
        setActiveConversation(null);
        setMessages([]);
        setMobileConversationOpen(false);
      }
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not leave channel');
    } finally {
      setDiscoveryActionLoading('');
    }
  };

  const handleJoinGroup = async (group: GroupDiscoveryItem) => {
    setDiscoveryActionLoading(group.conversationId);
    setSidebarError('');
    try {
      const conversation = await joinPublicGroup(group.conversationId);
      setConversations(prev => sortConversations(upsertConversation(prev, conversation)));
      setGroupResults(prev => prev.map(item =>
        item.conversationId === group.conversationId
          ? { ...item, isJoined: true, role: conversation.role as GroupDiscoveryItem['role'], memberCount: conversation.memberCount }
          : item
      ));
      await selectConversation(conversation);
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not join group');
    } finally {
      setDiscoveryActionLoading('');
    }
  };

  const handleOpenJoinedGroup = async (group: GroupDiscoveryItem) => {
    const conversation = conversations.find(item => item.id === group.conversationId);
    if (conversation) {
      await selectConversation(conversation);
      return;
    }

    await handleJoinGroup(group);
  };

  const logout = () => {
    authStore.clear();
    navigate('/login', { replace: true });
  };

  const openProfile = () => {
    if (!currentUser) return;
    setProfileUsername(currentUser.username);
    setProfileAvatar(currentUser.avatar || '');
    setProfileSearchable(currentUser.searchable !== false);
    setProfileAllowDirectMessages(currentUser.allowDirectMessages !== false);
    setProfileError('');
    setProfileNotice('');
    setProfileOpen(true);
  };

  const saveProfile = async () => {
    if (!currentUser || profileSaving) return;
    const username = profileUsername.trim();
    if (username.length < 2) {
      setProfileError('Username must be at least 2 characters');
      return;
    }

    setProfileSaving(true);
    setProfileError('');
    setProfileNotice('');
    try {
      const updated = await updateCurrentUser({
        username,
        avatar: profileAvatar,
        searchable: profileSearchable,
        allowDirectMessages: profileAllowDirectMessages,
      });
      const token = authStore.getToken();
      if (token) {
        authStore.setSession(token, updated);
      }
      setCurrentUser(updated);
      setProfileUsername(updated.username);
      setProfileAvatar(updated.avatar || '');
      setProfileSearchable(updated.searchable !== false);
      setProfileAllowDirectMessages(updated.allowDirectMessages !== false);
      setMessages(prev => prev.map(message =>
        message.senderId === updated.id
          ? { ...message, sender: { ...(message.sender || {}), id: updated.id, username: updated.username, avatar: updated.avatar } }
          : message
      ));
      setPinnedMessages(prev => prev.map(pinned => ({
        ...pinned,
        pinnedBy: pinned.pinnedById === updated.id
          ? { ...(pinned.pinnedBy || {}), id: updated.id, username: updated.username, avatar: updated.avatar }
          : pinned.pinnedBy,
        message: pinned.message.senderId === updated.id
          ? { ...pinned.message, sender: { ...(pinned.message.sender || {}), id: updated.id, username: updated.username, avatar: updated.avatar } }
          : pinned.message,
      })));
      setMembers(prev => prev.map(member =>
        member.userId === updated.id ? { ...member, user: { ...member.user, ...updated } } : member
      ));
      setProfileNotice('Profile saved');
    } catch (error: any) {
      setProfileError(error.response?.data?.message || 'Could not update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const enableBrowserNotifications = async () => {
    const permission = await requestBrowserNotificationPermission();
    setBrowserNotificationState(permission as BrowserNotificationState);
    if (permission !== 'granted') return;

    try {
      const pushConfig = await getPushPublicKey();
      if (!pushConfig.enabled || !pushConfig.publicKey) return;

      const subscription = await subscribeToWebPush(pushConfig.publicKey);
      if (subscription) {
        await savePushSubscription(subscription);
      }
    } catch {
      // Browser notifications still work in the foreground when Web Push is unavailable.
    }
  };

  const selectNotification = async (notification: NotificationItem) => {
    setNotifications(prev => prev.map(item => item.id === notification.id ? { ...item, read: true } : item));
    markNotificationRead(notification.id).catch(() => undefined);
    const conversation = conversations.find(item => item.id === notification.conversationId);
    if (conversation) {
      await selectConversation(conversation);
    }
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(notification => ({ ...notification, read: true })));
    markAllStoredNotificationsRead().catch(() => undefined);
  };

  const clearNotifications = () => {
    setNotifications([]);
    setNotificationsOpen(false);
    clearStoredNotifications().catch(() => undefined);
  };

  const handleTogglePinned = async (conversation: Conversation) => {
    try {
      setConversations(sortConversations(await updateConversationSettings(conversation.id, { pinned: !conversation.pinnedAt })));
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not update pin');
    }
  };

  const handleToggleMuted = async (conversation: Conversation) => {
    const isMuted = conversation.mutedUntil && new Date(conversation.mutedUntil) > new Date();
    try {
      setConversations(sortConversations(await updateConversationSettings(conversation.id, { muted: !isMuted })));
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not update mute');
    }
  };

  const handleArchive = async (conversation: Conversation) => {
    try {
      setConversations(sortConversations(await updateConversationSettings(conversation.id, { archived: true })));
      if (activeConversation?.id === conversation.id) {
        setActiveConversation(null);
        setMessages([]);
        setMobileConversationOpen(false);
      }
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not archive chat');
    }
  };

  const loadConversationLinks = async (conversation: Conversation, filter: 'all' | 'contact' | 'me') => {
    const senderId = conversation.type !== 'direct' || filter === 'all'
      ? undefined
      : filter === 'me'
        ? currentUser.id
        : conversation.user?.id;

    const linksData = await getConversationLinks(conversation.id, {
      limit: 40,
      senderId,
    });
    setLinkPreviews(linksData.links);
  };

  const openDetails = async () => {
    if (!activeConversation) return;
    setDetailsOpen(true);
    setDetailsError('');
    setDetailsNotice('');
    setInviteLinks([]);
    setMembers([]);
    setMediaAttachments([]);
    setFileAttachments([]);
    setLinkPreviews([]);
    setLinkFilter('all');
    setGroupNameDraft(activeConversation.name);
    setAnnouncementDraft(activeConversation.announcement || '');
    setMemberSearch('');
    setMemberSearchResults([]);

    setAttachmentsLoading(true);
    try {
      const attachmentsPromise = getConversationAttachments(activeConversation.id, { limit: 80 });
      const linksPromise = loadConversationLinks(activeConversation, 'all');
      const attachmentsData = await attachmentsPromise;
      await linksPromise;
      setMediaAttachments(attachmentsData.attachments.filter(attachment => attachment.kind !== 'file'));
      setFileAttachments(attachmentsData.attachments.filter(attachment => attachment.kind === 'file'));
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not load shared content');
    } finally {
      setAttachmentsLoading(false);
    }

    setMembersLoading(true);
    setInviteLoading(true);
    try {
      const nextMembers = activeConversation.type === 'channel'
        ? await getChannelMembers(activeConversation.id)
        : activeConversation.type === 'group'
          ? await getGroupMembers(activeConversation.id)
          : [];
      setMembers(nextMembers);
      const currentMember = nextMembers.find(member => member.userId === currentUser.id);
      if (activeConversation.type === 'group' && (currentMember?.role === 'owner' || currentMember?.role === 'admin')) {
        setInviteLinks(await getGroupInviteLinks(activeConversation.id));
      } else {
        setInviteLinks([]);
      }
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not load members');
    } finally {
      setMembersLoading(false);
      setInviteLoading(false);
    }
  };

  const changeLinkFilter = async (filter: 'all' | 'contact' | 'me') => {
    if (!activeConversation) return;
    setLinkFilter(filter);
    setAttachmentsLoading(true);
    setDetailsError('');
    try {
      await loadConversationLinks(activeConversation, filter);
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not load links');
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const createInviteLink = async () => {
    if (!activeConversation) return;
    setInviteLoading(true);
    setDetailsError('');
    setDetailsNotice('');
    try {
      const invite = await createGroupInviteLink(activeConversation.id);
      setInviteLinks(prev => [invite, ...prev]);
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not create invite link');
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteLink = async (invite: InviteLink) => {
    setDetailsError('');
    setDetailsNotice('');
    try {
      await copyTextToClipboard(`${window.location.origin}/chat?invite=${invite.code}`);
      setDetailsNotice('Invite link copied');
    } catch {
      setDetailsError('Could not copy invite link');
    }
  };

  const revokeInviteLink = async (inviteId: string) => {
    if (!activeConversation) return;
    setInviteLoading(true);
    setDetailsError('');
    setDetailsNotice('');
    try {
      const revoked = await revokeGroupInviteLink(activeConversation.id, inviteId);
      setInviteLinks(prev => prev.map(invite => invite.id === revoked.id ? revoked : invite));
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not revoke invite link');
    } finally {
      setInviteLoading(false);
    }
  };

  const saveGroupName = async () => {
    if (!activeConversation || activeConversation.type !== 'group') return;
    try {
      const updated = await updateGroup(activeConversation.id, { name: groupNameDraft.trim() });
      setActiveConversation(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
      setConversations(prev => prev.map(conversation => conversation.id === updated.id ? { ...conversation, ...updated } : conversation));
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not update group');
    }
  };

  const saveAnnouncement = async () => {
    if (!activeConversation || activeConversation.type !== 'group') return;
    try {
      const updated = await updateGroup(activeConversation.id, { announcement: announcementDraft });
      setActiveConversation(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
      setConversations(prev => prev.map(conversation => conversation.id === updated.id ? { ...conversation, ...updated } : conversation));
      setDetailsNotice('Announcement saved');
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not update announcement');
    }
  };

  const addMember = async (user: SearchUser) => {
    if (!activeConversation) return;
    try {
      const nextMembers = await addGroupMembers(activeConversation.id, [user.id]);
      setMembers(nextMembers);
      setMemberSearch('');
      setMemberSearchResults([]);
      setActiveConversation(prev => prev ? { ...prev, memberCount: nextMembers.length } : prev);
      setConversations(prev => prev.map(conversation =>
        conversation.id === activeConversation.id ? { ...conversation, memberCount: nextMembers.length } : conversation
      ));
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not add member');
    }
  };

  const removeMember = async (userId: string) => {
    if (!activeConversation) return;
    try {
      const nextMembers = await removeGroupMember(activeConversation.id, userId);
      setMembers(nextMembers);
      setActiveConversation(prev => prev ? { ...prev, memberCount: nextMembers.length } : prev);
      setConversations(prev => prev.map(conversation =>
        conversation.id === activeConversation.id ? { ...conversation, memberCount: nextMembers.length } : conversation
      ));
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not remove member');
    }
  };

  const typingText = activeConversation && typingUsers[activeConversation.id]?.length
    ? `${typingUsers[activeConversation.id].join(', ')} typing...`
    : '';

  return (
    <div className={`chat-shell ${mobileConversationOpen ? 'conversation-open' : ''}`}>
      <ConversationList
        currentUser={currentUser}
        conversations={conversations}
        activeConversationId={activeConversation?.id}
        search={search}
        users={searchResults}
        groupResults={groupResults}
        channelResults={channelResults}
        contacts={contacts}
        blockedUsers={blockedUsers}
        loading={loadingConversations}
        error={sidebarError}
        inviteInput={inviteInput}
        joiningInvite={joiningInvite}
        discoveryActionLoading={discoveryActionLoading}
        notificationSlot={(
          <NotificationMenu
            open={notificationsOpen}
            notifications={notifications}
            unreadCount={unreadNotificationCount}
            browserState={browserNotificationState}
            onToggleOpen={() => setNotificationsOpen(prev => !prev)}
            onEnableBrowserNotifications={enableBrowserNotifications}
            onSelect={selectNotification}
            onMarkAllRead={markAllNotificationsRead}
            onClear={clearNotifications}
          />
        )}
        onSearchChange={setSearch}
        onInviteInputChange={setInviteInput}
        onJoinInvite={() => joinInviteCode(inviteInput)}
        onSelectConversation={selectConversation}
        onStartDirect={handleStartDirect}
        onAddContact={handleAddContact}
        onRemoveContact={handleRemoveContact}
        onBlockUser={handleBlockUser}
        onUnblockUser={handleUnblockUser}
        onJoinGroup={handleJoinGroup}
        onOpenJoinedGroup={handleOpenJoinedGroup}
        onSubscribeChannel={handleSubscribeChannel}
        onUnsubscribeChannel={handleUnsubscribeChannel}
        onOpenCreateGroup={() => setCreateGroupOpen(true)}
        onOpenCreateChannel={() => setCreateChannelOpen(true)}
        onOpenProfile={openProfile}
        onLogout={logout}
        onTogglePinned={handleTogglePinned}
        onToggleMuted={handleToggleMuted}
        onArchive={handleArchive}
      />

      <main className="chat-panel">
        {activeConversation ? (
          <>
            <ChatHeader
              conversation={activeConversation}
              typingText={typingText}
              onBack={() => setMobileConversationOpen(false)}
              onOpenDetails={openDetails}
            />
            {activeConversation.type === 'group' && activeConversation.announcement && (
              <div className="announcement-bar">
                <strong>Announcement</strong>
                <span>{activeConversation.announcement}</span>
              </div>
            )}
            {pinnedMessages[0] && (
              <div className="pinned-message-bar">
                <button type="button" onClick={() => jumpToPinnedMessage(pinnedMessages[0])}>
                  <Pin size={16} />
                  <span>
                    <strong>{pinnedMessages.length > 1 ? `${pinnedMessages.length} pinned messages` : 'Pinned message'}</strong>
                    <small>{pinnedMessages[0].message.content || pinnedMessages[0].message.attachments?.[0]?.fileName || 'Attachment'}</small>
                  </span>
                </button>
                <button
                  className="mini-icon-button"
                  type="button"
                  onClick={() => handleTogglePin(pinnedMessages[0].message)}
                  disabled={pinLoading}
                  title="Unpin"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="message-search-bar">
              <label className="search-field">
                <input
                  value={messageSearch}
                  onChange={event => handleMessageSearch(event.target.value)}
                  placeholder="Search messages"
                />
              </label>
              {messageSearch.trim().length >= 2 && (
                <div className="message-search-results">
                  {searchingMessages && <span className="message-search-state">Searching...</span>}
                  {!searchingMessages && messageSearchResults.length === 0 && (
                    <span className="message-search-state">No results</span>
                  )}
                  {messageSearchResults.map(result => (
                    <button key={result.id} type="button" onClick={() => jumpToSearchResult(result)}>
                      <strong>{result.sender?.username || 'Message'}</strong>
                      <span>{result.content}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <MessageList
              currentUser={currentUser}
              messages={messages}
              loading={loadingMessages}
              loadingEarlier={loadingEarlier}
              hasMore={hasMoreMessages}
              error={messageError}
              unreadMarkerId={unreadMarkerId}
              listRef={messageListRef}
              bottomRef={bottomRef}
              pinnedMessageIds={pinnedMessageIds}
              onLoadEarlier={loadEarlierMessages}
              onScroll={handleMessageScroll}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReact={handleReact}
              onReply={handleReply}
              onForward={handleForward}
              onTogglePin={handleTogglePin}
            />
            {(showJumpLatest || (activeConversation.unreadCount || 0) > 0) && (
              <button className="jump-latest-button" type="button" onClick={jumpToLatest} title="Jump to latest">
                <ArrowDown size={16} />
                {(activeConversation.unreadCount || 0) > 0 && <span>{activeConversation.unreadCount}</span>}
              </button>
            )}
            {activeDirectBlocked && (
              <div className="state-banner error flush">Messaging is disabled for this conversation.</div>
            )}
            {activeChannelReadOnly && (
              <div className="state-banner flush">Only channel admins can post.</div>
            )}
            <MessageComposer
              value={draft}
              disabled={loadingMessages || activeDirectBlocked || activeChannelReadOnly}
              sending={sending}
              editing={Boolean(editingMessage)}
              replyTo={replyToMessage}
              attachments={pendingAttachments}
              onChange={handleDraftChange}
              onSend={handleSend}
              onCancelEdit={() => {
                setEditingMessage(null);
                setDraft('');
              }}
              onCancelReply={() => setReplyToMessage(null)}
              onSelectFiles={handleSelectFiles}
              onRemoveAttachment={removePendingAttachment}
            />
          </>
        ) : (
          <div className="empty-chat-panel">
            <MessageCircle size={44} />
            <strong>Select a chat</strong>
          </div>
        )}
      </main>

      <CreateGroupModal
        open={createGroupOpen}
        name={groupName}
        query={groupSearch}
        users={groupSearchResults}
        selectedUsers={selectedMembers}
        submitting={creatingGroup}
        error={createError}
        onNameChange={setGroupName}
        onQueryChange={setGroupSearch}
        onToggleUser={toggleMember}
        onSubmit={handleCreateGroup}
        onClose={() => setCreateGroupOpen(false)}
      />

      <CreateChannelModal
        open={createChannelOpen}
        name={channelName}
        description={channelDescription}
        submitting={creatingChannel}
        error={channelError}
        onNameChange={setChannelName}
        onDescriptionChange={setChannelDescription}
        onSubmit={handleCreateChannel}
        onClose={() => setCreateChannelOpen(false)}
      />

      <ProfileModal
        open={profileOpen}
        user={currentUser}
        username={profileUsername}
        avatar={profileAvatar}
        searchable={profileSearchable}
        allowDirectMessages={profileAllowDirectMessages}
        submitting={profileSaving}
        error={profileError}
        notice={profileNotice}
        onUsernameChange={setProfileUsername}
        onAvatarChange={setProfileAvatar}
        onSearchableChange={setProfileSearchable}
        onAllowDirectMessagesChange={setProfileAllowDirectMessages}
        onSubmit={saveProfile}
        onClose={() => setProfileOpen(false)}
      />

      <ConversationDetails
        open={detailsOpen}
        currentUser={currentUser}
        conversation={activeConversation}
        members={members}
        memberSearch={memberSearch}
        memberSearchResults={memberSearchResults}
        groupNameDraft={groupNameDraft}
        announcementDraft={announcementDraft}
        inviteLinks={inviteLinks}
        inviteLinkBaseUrl={`${window.location.origin}/chat?invite=`}
        inviteLoading={inviteLoading}
        mediaAttachments={mediaAttachments}
        fileAttachments={fileAttachments}
        linkPreviews={linkPreviews}
        linkFilter={linkFilter}
        attachmentsLoading={attachmentsLoading}
        loading={membersLoading}
        error={detailsError}
        notice={detailsNotice}
        onClose={() => setDetailsOpen(false)}
        onMemberSearchChange={setMemberSearch}
        onGroupNameDraftChange={setGroupNameDraft}
        onAnnouncementDraftChange={setAnnouncementDraft}
        onLinkFilterChange={changeLinkFilter}
        onSaveGroupName={saveGroupName}
        onSaveAnnouncement={saveAnnouncement}
        onAddMember={addMember}
        onRemoveMember={removeMember}
        onCreateInviteLink={createInviteLink}
        onCopyInviteLink={copyInviteLink}
        onRevokeInviteLink={revokeInviteLink}
      />
    </div>
  );
}
