import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { authStore } from '../features/auth/auth-store';
import type { User } from '../features/auth/types';
import {
  createDirectConversation,
  createGroup,
  deleteMessage,
  editMessage,
  addGroupMembers,
  getConversations,
  getGroupMembers,
  getMessages,
  markConversationRead,
  removeGroupMember,
  sendMessage,
  toggleReaction,
  updateConversationSettings,
  updateGroup,
} from '../features/chats/api';
import { ChatHeader } from '../features/chats/components/ChatHeader';
import { ConversationDetails } from '../features/chats/components/ConversationDetails';
import { ConversationList } from '../features/chats/components/ConversationList';
import { MessageComposer } from '../features/chats/components/MessageComposer';
import { MessageList } from '../features/chats/components/MessageList';
import { connectChatSocket, joinConversation, startTyping, stopTyping } from '../features/chats/socket';
import type { ChatSocket } from '../features/chats/socket';
import type { Conversation, GroupMember, Message } from '../features/chats/types';
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

export function ChatPage() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => authStore.getUser(), []) as User | null;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [socket, setSocket] = useState<ChatSocket | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [sidebarError, setSidebarError] = useState('');
  const [messageError, setMessageError] = useState('');
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
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<SearchUser[]>([]);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const activeConversationId = useRef<string | null>(null);
  const typingTimer = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
        setMessages(prev => prev.some(existing => existing.id === message.id) ? prev : [...prev, message]);
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
        setConversations(sortConversations(await getConversations()));
      } catch (error: any) {
        setSidebarError(error.response?.data?.message || 'Could not load chats');
      } finally {
        setLoadingConversations(false);
      }
    }

    load();
  }, []);

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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!currentUser) return null;

  const selectConversation = async (conversation: Conversation) => {
    setActiveConversation(conversation);
    setGroupNameDraft(conversation.name);
    setDetailsOpen(false);
    setMobileConversationOpen(true);
    setLoadingMessages(true);
    setMessageError('');
    joinConversation(socket, conversation.id);

    try {
      const data = await getMessages(conversation.id);
      setMessages(data.messages);
      const read = await markConversationRead(conversation.id).catch(() => null);
      setConversations(prev => prev.map(item =>
        item.id === conversation.id ? { ...item, unreadCount: 0, lastReadAt: read?.lastReadAt || item.lastReadAt } : item
      ));
    } catch (error: any) {
      setMessages([]);
      setMessageError(error.response?.data?.message || 'Could not load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!activeConversation || !content) return;

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
        const message = await sendMessage(activeConversation.id, content);
        setMessages(prev => prev.some(existing => existing.id === message.id) ? prev : [...prev, message]);
        setConversations(prev => sortConversations(prev.map(conversation =>
          conversation.id === message.conversationId
            ? { ...conversation, lastMessage: message, unreadCount: 0, lastActivityAt: message.createdAt }
            : conversation
        )));
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
    setDraft(message.content);
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
    setGroupNameDraft(activeConversation.name);
    setMemberSearch('');
    setMemberSearchResults([]);

    if (activeConversation.type !== 'group') return;

    setMembersLoading(true);
    try {
      setMembers(await getGroupMembers(activeConversation.id));
    } catch (error: any) {
      setDetailsError(error.response?.data?.message || 'Could not load members');
    } finally {
      setMembersLoading(false);
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
        onSearchChange={setSearch}
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
            <MessageList
              currentUser={currentUser}
              messages={messages}
              loading={loadingMessages}
              error={messageError}
              bottomRef={bottomRef}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReact={handleReact}
            />
            <MessageComposer
              value={draft}
              disabled={loadingMessages}
              sending={sending}
              editing={Boolean(editingMessage)}
              onChange={handleDraftChange}
              onSend={handleSend}
              onCancelEdit={() => {
                setEditingMessage(null);
                setDraft('');
              }}
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
        loading={membersLoading}
        error={detailsError}
        onClose={() => setDetailsOpen(false)}
        onMemberSearchChange={setMemberSearch}
        onGroupNameDraftChange={setGroupNameDraft}
        onSaveGroupName={saveGroupName}
        onAddMember={addMember}
        onRemoveMember={removeMember}
      />
    </div>
  );
}
