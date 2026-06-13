import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../notifications/types';
import {
  connectChatSocket,
  joinConversation,
  startTyping as socketStartTyping,
  stopTyping as socketStopTyping,
} from './socket';
import type { ChatSocket } from './socket';
import type { Message, PinnedMessage } from './types';
import { useChatSocket } from './useChatSocket';

vi.mock('./socket', () => ({
  connectChatSocket: vi.fn(),
  joinConversation: vi.fn(),
  startTyping: vi.fn(),
  stopTyping: vi.fn(),
}));

const mockConnectChatSocket = vi.mocked(connectChatSocket);
const mockJoinConversation = vi.mocked(joinConversation);
const mockSocketStartTyping = vi.mocked(socketStartTyping);
const mockSocketStopTyping = vi.mocked(socketStopTyping);

type SocketEventMap = {
  [event: string]: (payload: any) => void;
};

function createFakeSocket() {
  const events: SocketEventMap = {};
  const socket = {
    on: vi.fn((event: string, handler: (payload: any) => void) => {
      events[event] = handler;
      return socket;
    }),
    disconnect: vi.fn(),
  } as unknown as ChatSocket & {
    on: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };

  return { events, socket };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'message-1',
    content: 'Hello',
    type: 'text',
    senderId: 'user-1',
    conversationId: 'conversation-1',
    createdAt: '2026-06-13T00:00:00.000Z',
    ...overrides,
  };
}

function makeNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'notification-1',
    conversationId: 'conversation-1',
    messageId: 'message-1',
    title: 'New message',
    body: 'Hello',
    createdAt: '2026-06-13T00:00:00.000Z',
    read: false,
    ...overrides,
  };
}

function makePinnedMessage(overrides: Partial<PinnedMessage> = {}): PinnedMessage {
  return {
    conversationId: 'conversation-1',
    messageId: 'message-1',
    pinnedById: 'user-1',
    pinnedAt: '2026-06-13T00:01:00.000Z',
    message: makeMessage(),
    ...overrides,
  };
}

function makeHandlers() {
  return {
    onMessage: vi.fn(),
    onMessageDeleted: vi.fn(),
    onMessagePinned: vi.fn(),
    onMessageReaction: vi.fn(),
    onMessageRead: vi.fn(),
    onMessageUpdated: vi.fn(),
    onNotification: vi.fn(),
    onPresenceUpdate: vi.fn(),
    onTyping: vi.fn(),
  };
}

function renderUseChatSocket(options: Partial<Parameters<typeof useChatSocket>[0]> = {}) {
  const handlers = makeHandlers();

  return {
    handlers,
    ...renderHook(props => useChatSocket(props), {
      initialProps: {
        token: 'token-1',
        activeConversationId: null,
        ...handlers,
        ...options,
      },
    }),
  };
}

describe('useChatSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not connect without a token', () => {
    renderUseChatSocket({ token: null });

    expect(mockConnectChatSocket).not.toHaveBeenCalled();
    expect(mockJoinConversation).not.toHaveBeenCalled();
  });

  it('connects, registers socket events, and joins the active conversation', () => {
    const { events, socket } = createFakeSocket();
    mockConnectChatSocket.mockReturnValue(socket);
    const { handlers } = renderUseChatSocket({ activeConversationId: 'conversation-1' });

    expect(mockConnectChatSocket).toHaveBeenCalledWith('token-1');
    expect(socket.on).toHaveBeenCalledTimes(9);
    expect(mockJoinConversation).toHaveBeenCalledWith(socket, 'conversation-1');

    const message = makeMessage();
    const notification = makeNotification();
    const readPayload = {
      conversationId: 'conversation-1',
      userId: 'user-2',
      lastReadAt: '2026-06-13T00:02:00.000Z',
    };
    const pinnedPayload = {
      conversationId: 'conversation-1',
      pinnedMessages: [makePinnedMessage()],
    };
    const typingPayload = {
      conversationId: 'conversation-1',
      userId: 'user-2',
      username: 'alice',
      isTyping: true,
    };
    const presencePayload = {
      userId: 'user-2',
      status: 'online',
      lastSeen: '2026-06-13T00:03:00.000Z',
    };

    events.message(message);
    events.notification(notification);
    events['message:updated'](message);
    events['message:deleted'](message);
    events['message:reaction'](message);
    events['message:read'](readPayload);
    events['message:pinned'](pinnedPayload);
    events.typing(typingPayload);
    events['presence:update'](presencePayload);

    expect(handlers.onMessage).toHaveBeenCalledWith(message);
    expect(handlers.onNotification).toHaveBeenCalledWith(notification);
    expect(handlers.onMessageUpdated).toHaveBeenCalledWith(message);
    expect(handlers.onMessageDeleted).toHaveBeenCalledWith(message);
    expect(handlers.onMessageReaction).toHaveBeenCalledWith(message);
    expect(handlers.onMessageRead).toHaveBeenCalledWith(readPayload);
    expect(handlers.onMessagePinned).toHaveBeenCalledWith(pinnedPayload);
    expect(handlers.onTyping).toHaveBeenCalledWith(typingPayload);
    expect(handlers.onPresenceUpdate).toHaveBeenCalledWith(presencePayload);
  });

  it('uses the latest handlers without reconnecting', () => {
    const { events, socket } = createFakeSocket();
    mockConnectChatSocket.mockReturnValue(socket);
    const { handlers, rerender } = renderUseChatSocket();
    const nextHandlers = makeHandlers();

    rerender({
      token: 'token-1',
      activeConversationId: null,
      ...nextHandlers,
    });

    const message = makeMessage();
    events.message(message);

    expect(mockConnectChatSocket).toHaveBeenCalledTimes(1);
    expect(handlers.onMessage).not.toHaveBeenCalled();
    expect(nextHandlers.onMessage).toHaveBeenCalledWith(message);
  });

  it('joins conversations when the active conversation changes', () => {
    const { socket } = createFakeSocket();
    mockConnectChatSocket.mockReturnValue(socket);
    const { rerender } = renderUseChatSocket();

    rerender({
      token: 'token-1',
      activeConversationId: 'conversation-1',
      ...makeHandlers(),
    });
    rerender({
      token: 'token-1',
      activeConversationId: 'conversation-1',
      ...makeHandlers(),
    });
    rerender({
      token: 'token-1',
      activeConversationId: 'conversation-2',
      ...makeHandlers(),
    });
    rerender({
      token: 'token-1',
      activeConversationId: null,
      ...makeHandlers(),
    });
    rerender({
      token: 'token-1',
      activeConversationId: 'conversation-2',
      ...makeHandlers(),
    });

    expect(mockJoinConversation).toHaveBeenCalledTimes(3);
    expect(mockJoinConversation).toHaveBeenNthCalledWith(1, socket, 'conversation-1');
    expect(mockJoinConversation).toHaveBeenNthCalledWith(2, socket, 'conversation-2');
    expect(mockJoinConversation).toHaveBeenNthCalledWith(3, socket, 'conversation-2');
  });

  it('emits typing events through socket helpers', () => {
    const { socket } = createFakeSocket();
    mockConnectChatSocket.mockReturnValue(socket);
    const { result } = renderUseChatSocket();

    result.current.startTyping('conversation-1');
    result.current.stopTyping('conversation-1');

    expect(mockSocketStartTyping).toHaveBeenCalledWith(socket, 'conversation-1');
    expect(mockSocketStopTyping).toHaveBeenCalledWith(socket, 'conversation-1');
  });

  it('disconnects the active socket on unmount and reconnects when token changes', () => {
    const first = createFakeSocket();
    const second = createFakeSocket();
    mockConnectChatSocket
      .mockReturnValueOnce(first.socket)
      .mockReturnValueOnce(second.socket);

    const { rerender, unmount } = renderUseChatSocket();

    rerender({
      token: 'token-2',
      activeConversationId: null,
      ...makeHandlers(),
    });

    expect(first.socket.disconnect).toHaveBeenCalledTimes(1);
    expect(mockConnectChatSocket).toHaveBeenCalledWith('token-2');

    unmount();

    expect(second.socket.disconnect).toHaveBeenCalledTimes(1);
  });
});
