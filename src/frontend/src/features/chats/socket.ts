import { io, Socket } from 'socket.io-client';
import type { Message, PinnedMessage } from './types';
import type { NotificationItem } from '../notifications/types';

type ServerEvents = {
  message: (message: Message) => void;
  'message:updated': (message: Message) => void;
  'message:deleted': (message: Message) => void;
  'message:reaction': (message: Message) => void;
  'message:read': (payload: { conversationId: string; userId: string; lastReadAt: string }) => void;
  'message:pinned': (payload: { conversationId: string; pinnedMessages: PinnedMessage[] }) => void;
  notification: (notification: NotificationItem) => void;
  typing: (payload: { conversationId: string; userId: string; username: string; isTyping: boolean }) => void;
  'presence:update': (payload: { userId: string; status: string; lastSeen: string }) => void;
};

type ClientEvents = {
  joinConversation: (payload: { conversationId: string }) => void;
  'typing:start': (payload: { conversationId: string }) => void;
  'typing:stop': (payload: { conversationId: string }) => void;
};

export type ChatSocket = Socket<ServerEvents, ClientEvents>;

const socketUrl = import.meta.env.VITE_SOCKET_URL || '/';

export function connectChatSocket(token: string) {
  return io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
  }) as ChatSocket;
}

export function joinConversation(socket: Socket | null, conversationId: string) {
  socket?.emit('joinConversation', { conversationId });
}

export function startTyping(socket: ChatSocket | null, conversationId: string) {
  socket?.emit('typing:start', { conversationId });
}

export function stopTyping(socket: ChatSocket | null, conversationId: string) {
  socket?.emit('typing:stop', { conversationId });
}
