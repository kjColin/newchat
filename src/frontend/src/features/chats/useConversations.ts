import { useCallback, useEffect, useRef, useState } from 'react';
import { getConversations, updateConversationSettings } from './api';
import { sortConversations, upsertConversation } from './conversation-utils';
import type { Conversation, Message } from './types';
import type { SearchUser } from '../users/types';

type ConversationSetting = 'pinned' | 'muted' | 'archived';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [sidebarError, setSidebarError] = useState('');
  const conversationsRef = useRef<Conversation[]>([]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingConversations(true);
      setSidebarError('');
      try {
        const loaded = await getConversations();
        if (cancelled) return;
        setConversations(prev => sortConversations(loaded.reduce(upsertConversation, prev)));
      } catch (error: any) {
        if (!cancelled) {
          setSidebarError(error.response?.data?.message || 'Could not load chats');
        }
      } finally {
        if (!cancelled) {
          setLoadingConversations(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const upsertConversationItem = useCallback((conversation: Conversation) => {
    setConversations(prev => sortConversations(upsertConversation(prev, conversation)));
  }, []);

  const removeConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.filter(conversation => conversation.id !== conversationId));
  }, []);

  const updateConversationItem = useCallback((conversationId: string, updates: Partial<Conversation>) => {
    setConversations(prev => prev.map(conversation =>
      conversation.id === conversationId ? { ...conversation, ...updates } : conversation
    ));
  }, []);

  const updateActiveConversation = useCallback((conversationId: string, updates: Partial<Conversation>) => {
    setActiveConversation(prev => prev?.id === conversationId ? { ...prev, ...updates } : prev);
  }, []);

  const applyConversationRead = useCallback((conversationId: string, lastReadAt?: string) => {
    setActiveConversation(prev =>
      prev?.id === conversationId
        ? { ...prev, unreadCount: 0, lastReadAt: lastReadAt || prev.lastReadAt }
        : prev
    );
    setConversations(prev => prev.map(item =>
      item.id === conversationId ? { ...item, unreadCount: 0, lastReadAt: lastReadAt || item.lastReadAt } : item
    ));
  }, []);

  const applyMessageActivity = useCallback((message: Message, options: { currentUserId?: string; activeConversationId?: string | null } = {}) => {
    setConversations(prev => sortConversations(prev.map(conversation => {
      if (conversation.id !== message.conversationId) return conversation;

      const isActive = options.activeConversationId === message.conversationId;
      const isOwn = message.senderId === options.currentUserId;
      return {
        ...conversation,
        lastMessage: message,
        lastActivityAt: message.createdAt,
        unreadCount: isActive || isOwn ? 0 : (conversation.unreadCount || 0) + 1,
      };
    })));
  }, []);

  const applyLastMessageUpdate = useCallback((message: Message) => {
    setConversations(prev => prev.map(conversation =>
      conversation.lastMessage?.id === message.id ? { ...conversation, lastMessage: message } : conversation
    ));
  }, []);

  const applySentMessage = useCallback((message: Message) => {
    setConversations(prev => sortConversations(prev.map(conversation =>
      conversation.id === message.conversationId
        ? { ...conversation, lastMessage: message, unreadCount: 0, lastActivityAt: message.createdAt }
        : conversation
    )));
    updateActiveConversation(message.conversationId, {
      lastMessage: message,
      unreadCount: 0,
      lastActivityAt: message.createdAt,
    });
  }, [updateActiveConversation]);

  const applyForwardedMessage = useCallback((message: Message) => {
    setConversations(prev => sortConversations(prev.map(conversation =>
      conversation.id === message.conversationId
        ? { ...conversation, lastMessage: message, unreadCount: 0, lastActivityAt: message.createdAt }
        : conversation
    )));
  }, []);

  const applyPresenceUpdate = useCallback((payload: { userId: string; status: string; lastSeen: string }) => {
    setConversations(prev => prev.map(conversation => {
      if (conversation.user?.id !== payload.userId) return conversation;
      return {
        ...conversation,
        user: { ...conversation.user, status: payload.status, lastSeen: payload.lastSeen },
      };
    }));
  }, []);

  const applyDirectUserUpdate = useCallback((userId: string, updates: Partial<SearchUser>) => {
    setConversations(prev => prev.map(conversation =>
      conversation.user?.id === userId
        ? { ...conversation, user: { ...conversation.user, ...updates } }
        : conversation
    ));
    setActiveConversation(prev =>
      prev?.user?.id === userId
        ? { ...prev, user: { ...prev.user, ...updates } }
        : prev
    );
  }, []);

  const applyMemberCount = useCallback((conversationId: string, memberCount: number) => {
    updateActiveConversation(conversationId, { memberCount });
    updateConversationItem(conversationId, { memberCount });
  }, [updateActiveConversation, updateConversationItem]);

  const applyConversationPatch = useCallback((conversationId: string, updates: Partial<Conversation>) => {
    updateActiveConversation(conversationId, updates);
    updateConversationItem(conversationId, updates);
  }, [updateActiveConversation, updateConversationItem]);

  const updateConversationSetting = useCallback(async (conversation: Conversation, setting: ConversationSetting) => {
    const payload =
      setting === 'pinned'
        ? { pinned: !conversation.pinnedAt }
        : setting === 'muted'
          ? { muted: !(conversation.mutedUntil && new Date(conversation.mutedUntil) > new Date()) }
          : { archived: true };

    try {
      const updated = sortConversations(await updateConversationSettings(conversation.id, payload));
      setConversations(updated);
      return updated;
    } catch (error: any) {
      const message =
        setting === 'pinned'
          ? 'Could not update pin'
          : setting === 'muted'
            ? 'Could not update mute'
            : 'Could not archive chat';
      setSidebarError(error.response?.data?.message || message);
      return null;
    }
  }, []);

  return {
    conversations,
    activeConversation,
    loadingConversations,
    sidebarError,
    conversationsRef,
    setSidebarError,
    setActiveConversation,
    upsertConversation: upsertConversationItem,
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
  };
}
