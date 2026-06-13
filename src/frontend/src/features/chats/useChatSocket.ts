import { useCallback, useEffect, useRef } from 'react';
import type { NotificationItem } from '../notifications/types';
import {
  connectChatSocket,
  joinConversation as emitJoinConversation,
  startTyping as emitTypingStart,
  stopTyping as emitTypingStop,
} from './socket';
import type { ChatSocket } from './socket';
import type { Message, PinnedMessage } from './types';

type MessageReadPayload = {
  conversationId: string;
  userId: string;
  lastReadAt: string;
};

type TypingPayload = {
  conversationId: string;
  userId: string;
  username: string;
  isTyping: boolean;
};

type PresenceUpdatePayload = {
  userId: string;
  status: string;
  lastSeen: string;
};

type MessagePinnedPayload = {
  conversationId: string;
  pinnedMessages: PinnedMessage[];
};

type ChatSocketHandlers = {
  onMessage: (message: Message) => void;
  onNotification: (notification: NotificationItem) => void;
  onMessageUpdated: (message: Message) => void;
  onMessageDeleted: (message: Message) => void;
  onMessageReaction: (message: Message) => void;
  onMessageRead: (payload: MessageReadPayload) => void;
  onMessagePinned: (payload: MessagePinnedPayload) => void;
  onTyping: (payload: TypingPayload) => void;
  onPresenceUpdate: (payload: PresenceUpdatePayload) => void;
};

type UseChatSocketOptions = ChatSocketHandlers & {
  token: string | null;
  activeConversationId: string | null;
};

export function useChatSocket({
  token,
  activeConversationId,
  onMessage,
  onNotification,
  onMessageUpdated,
  onMessageDeleted,
  onMessageReaction,
  onMessageRead,
  onMessagePinned,
  onTyping,
  onPresenceUpdate,
}: UseChatSocketOptions) {
  const socketRef = useRef<ChatSocket | null>(null);
  const activeConversationIdRef = useRef(activeConversationId);
  const joinedConversationIdRef = useRef<string | null>(null);
  const handlersRef = useRef<ChatSocketHandlers>({
    onMessage,
    onNotification,
    onMessageUpdated,
    onMessageDeleted,
    onMessageReaction,
    onMessageRead,
    onMessagePinned,
    onTyping,
    onPresenceUpdate,
  });

  activeConversationIdRef.current = activeConversationId;
  handlersRef.current = {
    onMessage,
    onNotification,
    onMessageUpdated,
    onMessageDeleted,
    onMessageReaction,
    onMessageRead,
    onMessagePinned,
    onTyping,
    onPresenceUpdate,
  };

  useEffect(() => {
    if (!token) return undefined;

    const ws = connectChatSocket(token);
    socketRef.current = ws;
    joinedConversationIdRef.current = null;

    ws.on('message', message => handlersRef.current.onMessage(message));
    ws.on('notification', notification => handlersRef.current.onNotification(notification));
    ws.on('message:updated', message => handlersRef.current.onMessageUpdated(message));
    ws.on('message:deleted', message => handlersRef.current.onMessageDeleted(message));
    ws.on('message:reaction', message => handlersRef.current.onMessageReaction(message));
    ws.on('message:read', payload => handlersRef.current.onMessageRead(payload));
    ws.on('message:pinned', payload => handlersRef.current.onMessagePinned(payload));
    ws.on('typing', payload => handlersRef.current.onTyping(payload));
    ws.on('presence:update', payload => handlersRef.current.onPresenceUpdate(payload));

    const currentConversationId = activeConversationIdRef.current;
    if (currentConversationId) {
      emitJoinConversation(ws, currentConversationId);
      joinedConversationIdRef.current = currentConversationId;
    }

    return () => {
      if (socketRef.current === ws) {
        socketRef.current = null;
        joinedConversationIdRef.current = null;
      }
      ws.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (!activeConversationId) {
      joinedConversationIdRef.current = null;
      return;
    }

    if (joinedConversationIdRef.current !== activeConversationId) {
      emitJoinConversation(socketRef.current, activeConversationId);
      if (socketRef.current) {
        joinedConversationIdRef.current = activeConversationId;
      }
    }
  }, [activeConversationId]);

  const startTyping = useCallback((conversationId: string) => {
    emitTypingStart(socketRef.current, conversationId);
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    emitTypingStop(socketRef.current, conversationId);
  }, []);

  return {
    startTyping,
    stopTyping,
  };
}
