import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Attachment, Conversation, Message } from './types';
import {
  deleteMessage,
  editMessage,
  forwardMessage,
  getMessages,
  markConversationRead,
  searchMessages,
  sendMessage,
  toggleReaction,
  uploadFile,
} from './api';

function createClientId() {
  const random = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${random}`;
}

function sortMessages(list: Message[]) {
  return [...list].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

type SendCurrentMessageOptions = {
  conversation: Conversation | null;
  content: string;
  editingMessage: Message | null;
  replyToMessage: Message | null;
  pendingAttachments: Attachment[];
};

type LoadConversationMessagesOptions = {
  conversation: Conversation;
  currentUserId: string;
};

type UseMessagesOptions = {
  messageListRef: RefObject<HTMLElement>;
  onConversationRead: (conversationId: string, lastReadAt?: string) => void;
  onMessageEdited: (message: Message) => void;
  onMessageSent: (message: Message) => void;
  onMessageDeleted: (message: Message) => void;
  onMessageForwarded: (message: Message) => void;
};

export function useMessages({
  messageListRef,
  onConversationRead,
  onMessageEdited,
  onMessageSent,
  onMessageDeleted,
  onMessageForwarded,
}: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [unreadMarkerId, setUnreadMarkerId] = useState<string | null>(null);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState<Message[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const handlersRef = useRef({
    onConversationRead,
    onMessageEdited,
    onMessageSent,
    onMessageDeleted,
    onMessageForwarded,
  });

  handlersRef.current = {
    onConversationRead,
    onMessageEdited,
    onMessageSent,
    onMessageDeleted,
    onMessageForwarded,
  };

  const resetMessages = useCallback(() => {
    setMessages([]);
    setHasMoreMessages(false);
    setUnreadMarkerId(null);
    setShowJumpLatest(false);
    setMessageSearch('');
    setMessageSearchResults([]);
    setMessageError('');
  }, []);

  const loadConversationMessages = useCallback(async ({
    conversation,
    currentUserId,
  }: LoadConversationMessagesOptions) => {
    setMessageSearch('');
    setMessageSearchResults([]);
    setHasMoreMessages(false);
    setUnreadMarkerId(null);
    setShowJumpLatest(false);
    setLoadingMessages(true);
    setMessageError('');

    try {
      const data = await getMessages(conversation.id);
      setMessages(data.messages);
      setHasMoreMessages(data.hasMore);

      const marker = conversation.lastReadAt
        ? data.messages.find(message =>
            message.senderId !== currentUserId &&
            new Date(message.createdAt) > new Date(conversation.lastReadAt as string)
          )
        : null;
      setUnreadMarkerId(marker?.id || null);
      setShowJumpLatest(Boolean(marker));

      const read = await markConversationRead(conversation.id).catch(() => null);
      handlersRef.current.onConversationRead(conversation.id, read?.lastReadAt);
    } catch (error: any) {
      setMessages([]);
      setHasMoreMessages(false);
      setUnreadMarkerId(null);
      setShowJumpLatest(false);
      setMessageError(error.response?.data?.message || 'Could not load messages');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const sendCurrentMessage = useCallback(async ({
    conversation,
    content,
    editingMessage,
    replyToMessage,
    pendingAttachments,
  }: SendCurrentMessageOptions) => {
    const trimmed = content.trim();
    if (!conversation || (!trimmed && pendingAttachments.length === 0)) return null;

    setSending(true);
    setMessageError('');
    try {
      if (editingMessage) {
        const message = await editMessage(editingMessage.id, trimmed);
        setMessages(prev => prev.map(existing => existing.id === message.id ? message : existing));
        handlersRef.current.onMessageEdited(message);
        return { message, mode: 'edit' as const };
      }

      const hasImage = pendingAttachments.some(attachment => attachment.kind === 'image');
      const message = await sendMessage(conversation.id, trimmed, {
        clientId: createClientId(),
        replyToId: replyToMessage?.id,
        attachmentIds: pendingAttachments.map(attachment => attachment.id),
        type: pendingAttachments.length > 0 ? (hasImage ? 'image' : 'file') : 'text',
      });
      setMessages(prev => prev.some(existing => existing.id === message.id) ? prev : [...prev, message]);
      handlersRef.current.onMessageSent(message);
      return { message, mode: 'send' as const };
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not send message');
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  const forwardCurrentMessage = useCallback(async (message: Message, conversation: Conversation | null) => {
    if (!conversation) return;
    setMessageError('');
    try {
      const forwarded = await forwardMessage(message.id, conversation.id, createClientId());
      setMessages(prev => prev.some(existing => existing.id === forwarded.id) ? prev : [...prev, forwarded]);
      handlersRef.current.onMessageForwarded(forwarded);
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not forward message');
    }
  }, []);

  const deleteCurrentMessage = useCallback(async (message: Message) => {
    setMessageError('');
    try {
      const deleted = await deleteMessage(message.id);
      setMessages(prev => prev.map(item => item.id === deleted.id ? deleted : item));
      handlersRef.current.onMessageDeleted(deleted);
      return deleted;
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not delete message');
      return null;
    }
  }, []);

  const reactToMessage = useCallback(async (message: Message, emoji: string) => {
    try {
      const updated = await toggleReaction(message.id, emoji);
      setMessages(prev => prev.map(item => item.id === updated.id ? updated : item));
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not update reaction');
    }
  }, []);

  const searchConversationMessages = useCallback(async (conversation: Conversation | null, value: string) => {
    setMessageSearch(value);
    if (!conversation || value.trim().length < 2) {
      setMessageSearchResults([]);
      return;
    }

    setSearchingMessages(true);
    try {
      const data = await searchMessages(conversation.id, value.trim());
      setMessageSearchResults(data.messages);
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not search messages');
      setMessageSearchResults([]);
    } finally {
      setSearchingMessages(false);
    }
  }, []);

  const uploadAttachments = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return [];

    setMessageError('');
    setSending(true);
    try {
      return await Promise.all(Array.from(files).slice(0, 10).map(file => uploadFile(file)));
    } catch (error: any) {
      setMessageError(error.response?.data?.message || 'Could not upload file');
      return [];
    } finally {
      setSending(false);
    }
  }, []);

  const loadEarlierMessages = useCallback(async (conversation: Conversation | null) => {
    if (!conversation || messages.length === 0 || loadingEarlier || !hasMoreMessages) return;

    const first = messages[0];
    const list = messageListRef.current;
    const previousHeight = list?.scrollHeight || 0;
    setLoadingEarlier(true);
    setMessageError('');

    try {
      const data = await getMessages(conversation.id, {
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
  }, [hasMoreMessages, loadingEarlier, messageListRef, messages]);

  const applyIncomingMessage = useCallback((message: Message) => {
    setMessages(prev => prev.some(existing => existing.id === message.id) ? prev : [...prev, message]);
  }, []);

  const applyUpdatedMessage = useCallback((message: Message) => {
    setMessages(prev => prev.map(item => item.id === message.id ? message : item));
  }, []);

  const applyProfileUpdate = useCallback((user: { id: string; username: string; avatar?: string | null }) => {
    setMessages(prev => prev.map(message =>
      message.senderId === user.id
        ? { ...message, sender: { ...(message.sender || {}), id: user.id, username: user.username, avatar: user.avatar } }
        : message
    ));
  }, []);

  const ensureMessageVisible = useCallback((message: Message) => {
    setMessages(prev => prev.some(item => item.id === message.id) ? prev : sortMessages([...prev, message]));
  }, []);

  const clearMessageSearch = useCallback(() => {
    setMessageSearch('');
    setMessageSearchResults([]);
  }, []);

  return {
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
    loadEarlierMessages,
    applyIncomingMessage,
    applyUpdatedMessage,
    applyProfileUpdate,
    ensureMessageVisible,
    clearMessageSearch,
  };
}
