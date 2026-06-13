import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, MessageCircle, Pin, X } from 'lucide-react';
import { authStore } from '../features/auth/auth-store';
import type { User } from '../features/auth/types';
import {
  createChannel,
  createDirectConversation,
  createGroup,
  getPinnedMessages,
  joinGroupByInvite,
  joinPublicGroup,
  markConversationRead,
  pinMessage,
  subscribeChannel,
  unsubscribeChannel,
  unpinMessage,
} from '../features/chats/api';
import { ChatHeader } from '../features/chats/components/ChatHeader';
import { ConversationDetails } from '../features/chats/components/ConversationDetails';
import { ConversationList } from '../features/chats/components/ConversationList';
import { MessageComposer } from '../features/chats/components/MessageComposer';
import { MessageList } from '../features/chats/components/MessageList';
import type { Attachment, ChannelDiscoveryItem, Conversation, GroupDiscoveryItem, Message, PinnedMessage } from '../features/chats/types';
import { useChatSocket } from '../features/chats/useChatSocket';
import { useConversations } from '../features/chats/useConversations';
import { useConversationDetails } from '../features/chats/useConversationDetails';
import { useMessages } from '../features/chats/useMessages';
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
  unblockUser,
  updateCurrentUser,
} from '../features/users/api';
import type { BlockedUserEntry, ContactEntry, SearchUser } from '../features/users/types';
import { useUserSearch } from '../features/users/useUserSearch';
import { NotificationMenu } from '../features/notifications/components/NotificationMenu';
import { useNotifications } from '../features/notifications/useNotifications';
import './Chat.css';

function isNearBottom(element: HTMLElement | null) {
  if (!element) return true;
  return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
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
  const [draft, setDraft] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [pinLoading, setPinLoading] = useState(false);
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserEntry[]>([]);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<SearchUser[]>([]);
  const [createError, setCreateError] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [channelError, setChannelError] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
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
  const activeConversationId = useRef<string | null>(null);
  const handledInviteCode = useRef<string | null>(null);
  const typingTimer = useRef<number | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectConversationRef = useRef<(conversation: Conversation) => Promise<void>>();
  const {
    search,
    searchResults,
    groupResults,
    channelResults,
    discoveryActionLoading,
    groupSearch,
    groupSearchResults,
    memberSearch,
    memberSearchResults,
    setSearch,
    setDiscoveryActionLoading,
    setGroupSearch,
    setMemberSearch,
    setMemberSearchResults,
    clearSidebarSearch,
    clearGroupSearch,
    patchSearchUser,
    markChannelSubscribed,
    markChannelUnsubscribed,
    markGroupJoined,
  } = useUserSearch();
  const {
    conversations,
    activeConversation,
    loadingConversations,
    sidebarError,
    conversationsRef,
    setSidebarError,
    setActiveConversation,
    upsertConversation,
    removeConversation,
    updateActiveConversation,
    applyConversationRead,
    applyMessageActivity,
    applyLastMessageUpdate,
    applySentMessage,
    applyForwardedMessage,
    applyPresenceUpdate,
    applyDirectUserUpdate,
    applyMemberCount,
    applyConversationPatch,
    updateConversationSetting,
  } = useConversations();
  const {
    detailsOpen,
    members,
    membersLoading,
    detailsError,
    detailsNotice,
    mediaAttachments,
    fileAttachments,
    linkPreviews,
    linkFilter,
    attachmentsLoading,
    groupNameDraft,
    announcementDraft,
    inviteLinks,
    inviteLoading,
    setGroupNameDraft,
    setAnnouncementDraft,
    openDetails,
    closeDetails,
    resetDetails,
    changeLinkFilter,
    createInviteLink,
    copyInviteLink,
    revokeInviteLink,
    saveGroupName,
    saveAnnouncement,
    addMember,
    removeMember,
    applyProfileUpdate: applyDetailsProfileUpdate,
  } = useConversationDetails({
    currentUser,
    onConversationPatch: applyConversationPatch,
    onMemberCountChange: applyMemberCount,
  });
  const {
    messages,
    loadingMessages,
    loadingEarlier,
    hasMoreMessages,
    unreadMarkerId,
    showJumpLatest,
    messageError,
    messageSearch,
    messageSearchResults,
    searchingMessages,
    sending,
    setMessageError,
    setUnreadMarkerId,
    setShowJumpLatest,
    resetMessages,
    loadConversationMessages,
    sendCurrentMessage,
    forwardCurrentMessage,
    deleteCurrentMessage,
    reactToMessage,
    searchConversationMessages,
    uploadAttachments,
    loadEarlierMessages: loadEarlierConversationMessages,
    applyIncomingMessage,
    applyUpdatedMessage,
    applyProfileUpdate,
    ensureMessageVisible,
    clearMessageSearch,
  } = useMessages({
    messageListRef,
    onConversationRead: (conversationId, lastReadAt) => {
      applyConversationRead(conversationId, lastReadAt);
    },
    onMessageEdited: message => {
      applyLastMessageUpdate(message);
    },
    onMessageSent: message => {
      applySentMessage(message);
    },
    onMessageDeleted: message => {
      applyLastMessageUpdate(message);
    },
    onMessageForwarded: message => {
      applyForwardedMessage(message);
    },
  });
  const pinnedMessageIds = useMemo(() => new Set(pinnedMessages.map(item => item.messageId)), [pinnedMessages]);
  const {
    notifications,
    notificationsOpen,
    unreadNotificationCount,
    browserNotificationState,
    setNotificationsOpen,
    markConversationNotificationsLocalRead,
    receiveNotification,
    enableBrowserNotifications,
    selectNotification,
    markAllNotificationsRead,
    clearNotifications,
    showBrowserNotification,
  } = useNotifications({
    activeConversationId: activeConversation?.id || null,
    conversations,
    onSelectConversation: async conversation => {
      await selectConversationRef.current?.(conversation);
    },
  });
  const activeDirectBlocked = Boolean(activeConversation?.type === 'direct' && activeConversation.user?.isBlocked);
  const activeChannelReadOnly = Boolean(
    activeConversation?.type === 'channel' &&
    !['owner', 'admin'].includes(activeConversation.role || ''),
  );

  const selectConversation = useCallback(async (conversation: Conversation) => {
    setActiveConversation(conversation);
    setReplyToMessage(null);
    setPendingAttachments([]);
    resetMessages();
    setPinnedMessages([]);
    resetDetails();
    setMobileConversationOpen(true);
    markConversationNotificationsLocalRead(conversation.id);

    getPinnedMessages(conversation.id)
      .then(setPinnedMessages)
      .catch(() => setPinnedMessages([]));
    await loadConversationMessages({ conversation, currentUserId: currentUser.id });
  }, [currentUser.id, loadConversationMessages, markConversationNotificationsLocalRead, resetMessages]);

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
      upsertConversation(conversation);
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
    selectConversationRef.current = selectConversation;
  }, [selectConversation]);

  const { startTyping: startSocketTyping, stopTyping: stopSocketTyping } = useChatSocket({
    token: authStore.getToken(),
    activeConversationId: activeConversation?.id || null,
    onMessage: message => {
      applyMessageActivity(message, {
        activeConversationId: activeConversationId.current,
        currentUserId: currentUser?.id,
      });

      if (activeConversationId.current === message.conversationId) {
        const wasNearBottom = isNearBottom(messageListRef.current);
        applyIncomingMessage(message);
        updateActiveConversation(message.conversationId, {
          lastMessage: message,
          lastActivityAt: message.createdAt,
          unreadCount: 0,
        });
        if (!wasNearBottom && message.senderId !== currentUser?.id) {
          setShowJumpLatest(true);
        }
        if (message.senderId !== currentUser?.id) {
          markConversationRead(message.conversationId).catch(() => undefined);
        }
      } else if (message.senderId !== currentUser?.id) {
        showMessageNotification(message);
      }
    },
    onNotification: receiveNotification,
    onMessageUpdated: message => {
      applyUpdatedMessage(message);
      applyLastMessageUpdate(message);
    },
    onMessageDeleted: message => {
      applyUpdatedMessage(message);
      applyLastMessageUpdate(message);
    },
    onMessageReaction: message => {
      applyUpdatedMessage(message);
    },
    onMessageRead: payload => {
      if (payload.userId === currentUser?.id) {
        applyConversationRead(payload.conversationId, payload.lastReadAt);
      }
    },
    onMessagePinned: payload => {
      if (activeConversationId.current === payload.conversationId) {
        setPinnedMessages(payload.pinnedMessages);
      }
    },
    onTyping: payload => {
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
    },
    onPresenceUpdate: payload => {
      applyPresenceUpdate(payload);
    },
  });

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
    const code = new URLSearchParams(window.location.search).get('invite');
    if (!code || handledInviteCode.current === code) return;

    handledInviteCode.current = code;
    joinInviteCode(code, { clearUrl: true });
  }, [joinInviteCode]);

  useEffect(() => {
    if (!loadingEarlier && isNearBottom(messageListRef.current)) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, loadingEarlier]);

  if (!currentUser) return null;

  const handleSend = async () => {
    const result = await sendCurrentMessage({
      conversation: activeConversation,
      content: draft,
      editingMessage,
      replyToMessage,
      pendingAttachments,
    });
    if (!result) return;

    if (result.mode === 'edit') {
      setEditingMessage(null);
    } else {
      setReplyToMessage(null);
      setPendingAttachments([]);
    }
    setDraft('');
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!activeConversation || editingMessage) return;

    startSocketTyping(activeConversation.id);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      stopSocketTyping(activeConversation.id);
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
    const nextAttachments = await uploadAttachments(files);
    if (nextAttachments.length > 0) {
      setPendingAttachments(prev => [...prev, ...nextAttachments].slice(0, 10));
    }
  };

  const removePendingAttachment = (attachmentId: string) => {
    setPendingAttachments(prev => prev.filter(attachment => attachment.id !== attachmentId));
  };

  const handleForward = async (message: Message) => {
    await forwardCurrentMessage(message, activeConversation);
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
    const deleted = await deleteCurrentMessage(message);
    if (deleted && editingMessage?.id === message.id) {
      setEditingMessage(null);
      setDraft('');
    }
  };

  const handleReact = async (message: Message, emoji: string) => {
    await reactToMessage(message, emoji);
  };

  const handleMessageSearch = async (value: string) => {
    await searchConversationMessages(activeConversation, value);
  };

  const loadEarlierMessages = async () => {
    await loadEarlierConversationMessages(activeConversation);
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
    applyConversationRead(activeConversation.id, read?.lastReadAt);
  };

  const jumpToSearchResult = (message: Message) => {
    clearMessageSearch();
    ensureMessageVisible(message);

    window.setTimeout(() => {
      document.getElementById(`message-${message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const jumpToPinnedMessage = (pinned: PinnedMessage) => {
    const message = pinned.message;
    ensureMessageVisible(message);

    window.setTimeout(() => {
      document.getElementById(`message-${message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleStartDirect = async (user: SearchUser) => {
    if (user.isBlocked) return;
    setSidebarError('');
    try {
      const conversation = await createDirectConversation(user.id);
      upsertConversation(conversation);
      clearSidebarSearch();
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
      patchSearchUser(user.id, { isContact: true, isBlocked: false });
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not add contact');
    }
  };

  const handleRemoveContact = async (user: SearchUser) => {
    setSidebarError('');
    try {
      const nextContacts = await removeContact(user.id);
      setContacts(nextContacts);
      patchSearchUser(user.id, { isContact: false });
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
      patchSearchUser(user.id, { isContact: false, isBlocked: true });
      applyDirectUserUpdate(user.id, { isContact: false, isBlocked: true });
    } catch (error: any) {
      setSidebarError(error.response?.data?.message || 'Could not block user');
    }
  };

  const handleUnblockUser = async (user: SearchUser) => {
    setSidebarError('');
    try {
      const nextBlocked = await unblockUser(user.id);
      setBlockedUsers(nextBlocked);
      patchSearchUser(user.id, { isBlocked: false });
      applyDirectUserUpdate(user.id, { isBlocked: false });
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
      upsertConversation(conversation);
      setCreateGroupOpen(false);
      setGroupName('');
      clearGroupSearch();
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
      upsertConversation(conversation);
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
      upsertConversation(conversation);
      markChannelSubscribed(channel, conversation.role as ChannelDiscoveryItem['role'], conversation.memberCount);
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
      removeConversation(channel.conversationId);
      markChannelUnsubscribed(channel);
      if (activeConversation?.id === channel.conversationId) {
        setActiveConversation(null);
        resetMessages();
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
      upsertConversation(conversation);
      markGroupJoined(group, conversation.role as GroupDiscoveryItem['role'], conversation.memberCount);
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
      applyProfileUpdate(updated);
      applyDetailsProfileUpdate(updated);
      setPinnedMessages(prev => prev.map(pinned => ({
        ...pinned,
        pinnedBy: pinned.pinnedById === updated.id
          ? { ...(pinned.pinnedBy || {}), id: updated.id, username: updated.username, avatar: updated.avatar }
          : pinned.pinnedBy,
        message: pinned.message.senderId === updated.id
          ? { ...pinned.message, sender: { ...(pinned.message.sender || {}), id: updated.id, username: updated.username, avatar: updated.avatar } }
          : pinned.message,
      })));
      setProfileNotice('Profile saved');
    } catch (error: any) {
      setProfileError(error.response?.data?.message || 'Could not update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleTogglePinned = async (conversation: Conversation) => {
    await updateConversationSetting(conversation, 'pinned');
  };

  const handleToggleMuted = async (conversation: Conversation) => {
    await updateConversationSetting(conversation, 'muted');
  };

  const handleArchive = async (conversation: Conversation) => {
    const updated = await updateConversationSetting(conversation, 'archived');
    if (updated && activeConversation?.id === conversation.id) {
      setActiveConversation(null);
      resetMessages();
      setMobileConversationOpen(false);
    }
  };

  const handleOpenDetails = async () => {
    await openDetails(activeConversation);
  };

  const handleChangeLinkFilter = async (filter: 'all' | 'contact' | 'me') => {
    await changeLinkFilter(activeConversation, filter);
  };

  const handleCreateInviteLink = async () => {
    await createInviteLink(activeConversation);
  };

  const handleRevokeInviteLink = async (inviteId: string) => {
    await revokeInviteLink(activeConversation, inviteId);
  };

  const handleSaveGroupName = async () => {
    await saveGroupName(activeConversation);
  };

  const handleSaveAnnouncement = async () => {
    await saveAnnouncement(activeConversation);
  };

  const handleAddMember = async (user: SearchUser) => {
    await addMember(activeConversation, user);
  };

  const handleRemoveMember = async (userId: string) => {
    await removeMember(activeConversation, userId);
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
              onOpenDetails={handleOpenDetails}
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
        onClose={closeDetails}
        onMemberSearchChange={setMemberSearch}
        onGroupNameDraftChange={setGroupNameDraft}
        onAnnouncementDraftChange={setAnnouncementDraft}
        onLinkFilterChange={handleChangeLinkFilter}
        onSaveGroupName={handleSaveGroupName}
        onSaveAnnouncement={handleSaveAnnouncement}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        onCreateInviteLink={handleCreateInviteLink}
        onCopyInviteLink={copyInviteLink}
        onRevokeInviteLink={handleRevokeInviteLink}
      />
    </div>
  );
}
