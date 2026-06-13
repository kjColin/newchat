import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, MessageCircle } from 'lucide-react';
import { authStore } from '../features/auth/auth-store';
import type { User } from '../features/auth/types';
import {
  createDirectConversation,
  createGroup,
  createGroupInviteLink,
  deleteMessage,
  editMessage,
  addGroupMembers,
  forwardMessage,
  getConversations,
  getConversationAttachments,
  getGroupInviteLinks,
  getGroupMembers,
  getMessages,
  joinGroupByInvite,
  markConversationRead,
  removeGroupMember,
  revokeGroupInviteLink,
  searchMessages,
  sendMessage,
  toggleReaction,
  updateConversationSettings,
  updateGroup,
  uploadFile,
} from '../features/chats/api';
import { ChatHeader } from '../features/chats/components/ChatHeader';
import { ConversationDetails } from '../features/chats/components/ConversationDetails';
import { ConversationList } from '../features/chats/components/ConversationList';
import { MessageComposer } from '../features/chats/components/MessageComposer';
import { MessageList } from '../features/chats/components/MessageList';
import { connectChatSocket, joinConversation, startTyping, stopTyping } from '../features/chats/socket';
import type { ChatSocket } from '../features/chats/socket';
import type { Attachment, Conversation, GroupMember, InviteLink, Message } from '../features/chats/types';
import { CreateGroupModal } from '../features/groups/components/CreateGroupModal';
import { searchUsers } from '../features/users/api';
import type { SearchUser } from '../features/users/types';
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

export function ChatPage() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => authStore.getUser(), []) as User | null;
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
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState<SearchUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<SearchUser[]>([]);
  const [createError, setCreateError] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsNotice, setDetailsNotice] = useState('');
  const [mediaAttachments, setMediaAttachments] = useState<Attachment[]>([]);
  const [fileAttachments, setFileAttachments] = useState<Attachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<SearchUser[]>([]);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [joiningInvite, setJoiningInvite] = useState(false);
  const activeConversationId = useRef<string | null>(null);
  const handledInviteCode = useRef<string | null>(null);
  const typingTimer = useRef<number | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectConversation = useCallback(async (conversation: Conversation) => {
    setActiveConversation(conversation);
    setGroupNameDraft(conversation.name);
    setReplyToMessage(null);
    setPendingAttachments([]);
    setMessageSearch('');
    setMessageSearchResults([]);
    setHasMoreMessages(false);
    setUnreadMarkerId(null);
    setShowJumpLatest(false);
    setDetailsOpen(false);
    setMobileConversationOpen(true);
    setLoadingMessages(true);
    setMessageError('');
    joinConversation(socket, conversation.id);

    try {
      const data = await getMessages(conversation.id);
      setMessages(data.messages);
      setHasMoreMessages(data.hasMore);
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
    activeConversationId.current = activeConversation?.id || null;
  }, [activeConversation?.id]);

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
      }
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
  }, [currentUser?.id]);

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
    const code = new URLSearchParams(window.location.search).get('invite');
    if (!code || handledInviteCode.current === code) return;

    handledInviteCode.current = code;
    joinInviteCode(code, { clearUrl: true });
  }, [joinInviteCode]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        setSearchResults(await searchUsers(search));
      } catch {
        setSearchResults([]);
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

  const handleStartDirect = async (user: SearchUser) => {
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

  const logout = () => {
    authStore.clear();
    navigate('/login', { replace: true });
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

  const openDetails = async () => {
    if (!activeConversation) return;
    setDetailsOpen(true);
    setDetailsError('');
    setDetailsNotice('');
    setInviteLinks([]);
    setMembers([]);
    setMediaAttachments([]);
    setFileAttachments([]);
    setGroupNameDraft(activeConversation.name);
    setMemberSearch('');
    setMemberSearchResults([]);

    setAttachmentsLoading(true);
    try {
      const data = await getConversationAttachments(activeConversation.id, { limit: 80 });
      setMediaAttachments(data.attachments.filter(attachment => attachment.kind !== 'file'));
      setFileAttachments(data.attachments.filter(attachment => attachment.kind === 'file'));
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not load shared files');
    } finally {
      setAttachmentsLoading(false);
    }

    if (activeConversation.type !== 'group') return;

    setMembersLoading(true);
    setInviteLoading(true);
    try {
      const nextMembers = await getGroupMembers(activeConversation.id);
      setMembers(nextMembers);
      const currentMember = nextMembers.find(member => member.userId === currentUser.id);
      if (currentMember?.role === 'owner' || currentMember?.role === 'admin') {
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
        loading={loadingConversations}
        error={sidebarError}
        inviteInput={inviteInput}
        joiningInvite={joiningInvite}
        onSearchChange={setSearch}
        onInviteInputChange={setInviteInput}
        onJoinInvite={() => joinInviteCode(inviteInput)}
        onSelectConversation={selectConversation}
        onStartDirect={handleStartDirect}
        onOpenCreateGroup={() => setCreateGroupOpen(true)}
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
              onLoadEarlier={loadEarlierMessages}
              onScroll={handleMessageScroll}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReact={handleReact}
              onReply={handleReply}
              onForward={handleForward}
            />
            {(showJumpLatest || (activeConversation.unreadCount || 0) > 0) && (
              <button className="jump-latest-button" type="button" onClick={jumpToLatest} title="Jump to latest">
                <ArrowDown size={16} />
                {(activeConversation.unreadCount || 0) > 0 && <span>{activeConversation.unreadCount}</span>}
              </button>
            )}
            <MessageComposer
              value={draft}
              disabled={loadingMessages}
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

      <ConversationDetails
        open={detailsOpen}
        currentUser={currentUser}
        conversation={activeConversation}
        members={members}
        memberSearch={memberSearch}
        memberSearchResults={memberSearchResults}
        groupNameDraft={groupNameDraft}
        inviteLinks={inviteLinks}
        inviteLinkBaseUrl={`${window.location.origin}/chat?invite=`}
        inviteLoading={inviteLoading}
        mediaAttachments={mediaAttachments}
        fileAttachments={fileAttachments}
        attachmentsLoading={attachmentsLoading}
        loading={membersLoading}
        error={detailsError}
        notice={detailsNotice}
        onClose={() => setDetailsOpen(false)}
        onMemberSearchChange={setMemberSearch}
        onGroupNameDraftChange={setGroupNameDraft}
        onSaveGroupName={saveGroupName}
        onAddMember={addMember}
        onRemoveMember={removeMember}
        onCreateInviteLink={createInviteLink}
        onCopyInviteLink={copyInviteLink}
        onRevokeInviteLink={revokeInviteLink}
      />
    </div>
  );
}
