import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../chats/types';
import {
  clearNotifications,
  getNotifications,
  getPushPublicKey,
  markAllNotificationsRead,
  markConversationNotificationsRead,
  markNotificationRead,
  savePushSubscription,
} from './api';
import {
  getBrowserNotificationState,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  subscribeToWebPush,
} from './browser-notifications';
import type { NotificationItem } from './types';
import { useNotifications } from './useNotifications';

vi.mock('./api', () => ({
  clearNotifications: vi.fn(),
  getNotifications: vi.fn(),
  getPushPublicKey: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markConversationNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  savePushSubscription: vi.fn(),
}));

vi.mock('./browser-notifications', () => ({
  getBrowserNotificationState: vi.fn(),
  requestBrowserNotificationPermission: vi.fn(),
  showBrowserNotification: vi.fn(),
  subscribeToWebPush: vi.fn(),
}));

const mockClearNotifications = vi.mocked(clearNotifications);
const mockGetNotifications = vi.mocked(getNotifications);
const mockGetPushPublicKey = vi.mocked(getPushPublicKey);
const mockMarkAllNotificationsRead = vi.mocked(markAllNotificationsRead);
const mockMarkConversationNotificationsRead = vi.mocked(markConversationNotificationsRead);
const mockMarkNotificationRead = vi.mocked(markNotificationRead);
const mockSavePushSubscription = vi.mocked(savePushSubscription);
const mockGetBrowserNotificationState = vi.mocked(getBrowserNotificationState);
const mockRequestBrowserNotificationPermission = vi.mocked(requestBrowserNotificationPermission);
const mockShowBrowserNotification = vi.mocked(showBrowserNotification);
const mockSubscribeToWebPush = vi.mocked(subscribeToWebPush);

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

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conversation-1',
    conversationId: 'conversation-1',
    type: 'direct',
    name: 'Alice',
    memberCount: 2,
    ...overrides,
  };
}

function renderUseNotifications(options: Partial<Parameters<typeof useNotifications>[0]> = {}) {
  return renderHook(() =>
    useNotifications({
      activeConversationId: null,
      conversations: [],
      onSelectConversation: vi.fn(),
      ...options,
    }),
  );
}

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBrowserNotificationState.mockReturnValue('default');
    mockGetNotifications.mockResolvedValue([]);
    mockMarkConversationNotificationsRead.mockResolvedValue({ updated: 1 });
    mockMarkNotificationRead.mockResolvedValue({ updated: 1 });
    mockMarkAllNotificationsRead.mockResolvedValue({ updated: 1 });
    mockClearNotifications.mockResolvedValue({ deleted: 1 });
    mockRequestBrowserNotificationPermission.mockResolvedValue('default');
    mockGetPushPublicKey.mockResolvedValue({ enabled: false, publicKey: '' });
    mockSubscribeToWebPush.mockResolvedValue(null);
    mockSavePushSubscription.mockResolvedValue({ subscribed: true });
  });

  it('loads stored notifications and exposes unread count', async () => {
    const readNotification = makeNotification({ id: 'notification-read', read: true });
    const unreadNotification = makeNotification({ id: 'notification-unread', read: false });
    mockGetNotifications.mockResolvedValue([readNotification, unreadNotification]);

    const { result } = renderUseNotifications();

    await waitFor(() => {
      expect(result.current.notifications).toEqual([readNotification, unreadNotification]);
    });
    expect(result.current.unreadNotificationCount).toBe(1);
    expect(result.current.browserNotificationState).toBe('default');
  });

  it('marks notifications for the active conversation read when receiving them', async () => {
    const notification = makeNotification({ conversationId: 'conversation-active', read: false });

    const { result } = renderUseNotifications({
      activeConversationId: 'conversation-active',
    });

    await waitFor(() => {
      expect(mockGetNotifications).toHaveBeenCalled();
    });

    act(() => {
      result.current.receiveNotification(notification);
    });

    expect(result.current.notifications[0]).toMatchObject({ id: notification.id, read: true });
    expect(result.current.unreadNotificationCount).toBe(0);
    expect(mockMarkConversationNotificationsRead).toHaveBeenCalledWith('conversation-active');
  });

  it('deduplicates received notifications and keeps the newest 30 items', async () => {
    const storedNotifications = Array.from({ length: 30 }, (_, index) =>
      makeNotification({
        id: `notification-${index}`,
        conversationId: `conversation-${index}`,
        createdAt: `2026-06-13T00:00:${String(index).padStart(2, '0')}.000Z`,
      }),
    );
    mockGetNotifications.mockResolvedValue(storedNotifications);

    const { result } = renderUseNotifications();

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(30);
    });

    const replacement = makeNotification({
      id: 'notification-5',
      conversationId: 'conversation-new',
      title: 'Replacement',
    });

    act(() => {
      result.current.receiveNotification(replacement);
    });

    expect(result.current.notifications).toHaveLength(30);
    expect(result.current.notifications[0]).toEqual(replacement);
    expect(result.current.notifications.filter(item => item.id === replacement.id)).toHaveLength(1);
  });

  it('selects the matching conversation and marks the notification read', async () => {
    const conversation = makeConversation();
    const notification = makeNotification({ conversationId: conversation.id, read: false });
    const onSelectConversation = vi.fn().mockResolvedValue(undefined);
    mockGetNotifications.mockResolvedValue([notification]);

    const { result } = renderUseNotifications({
      conversations: [conversation],
      onSelectConversation,
    });

    await waitFor(() => {
      expect(result.current.notifications).toEqual([notification]);
    });

    await act(async () => {
      await result.current.selectNotification(notification);
    });

    expect(result.current.notifications[0]).toMatchObject({ read: true });
    expect(mockMarkNotificationRead).toHaveBeenCalledWith(notification.id);
    expect(onSelectConversation).toHaveBeenCalledWith(conversation);
  });

  it('marks all notifications read and clears notifications locally', async () => {
    const notification = makeNotification();
    mockGetNotifications.mockResolvedValue([notification]);

    const { result } = renderUseNotifications();

    await waitFor(() => {
      expect(result.current.notifications).toEqual([notification]);
    });

    act(() => {
      result.current.markAllNotificationsRead();
    });

    expect(result.current.notifications[0]).toMatchObject({ read: true });
    expect(result.current.unreadNotificationCount).toBe(0);
    expect(mockMarkAllNotificationsRead).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setNotificationsOpen(true);
      result.current.clearNotifications();
    });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.notificationsOpen).toBe(false);
    expect(mockClearNotifications).toHaveBeenCalledTimes(1);
  });

  it('requests browser permission and saves a web push subscription when available', async () => {
    const subscription = {
      toJSON: () => ({ endpoint: 'https://push.example/subscription' }),
    } as PushSubscription;
    mockRequestBrowserNotificationPermission.mockResolvedValue('granted');
    mockGetPushPublicKey.mockResolvedValue({ enabled: true, publicKey: 'public-key' });
    mockSubscribeToWebPush.mockResolvedValue(subscription);

    const { result } = renderUseNotifications();

    await act(async () => {
      await result.current.enableBrowserNotifications();
    });

    expect(result.current.browserNotificationState).toBe('granted');
    expect(mockGetPushPublicKey).toHaveBeenCalledTimes(1);
    expect(mockSubscribeToWebPush).toHaveBeenCalledWith('public-key');
    expect(mockSavePushSubscription).toHaveBeenCalledWith(subscription);
  });

  it('returns the browser notification presenter from the hook', () => {
    const { result } = renderUseNotifications();

    result.current.showBrowserNotification('Title', 'Body');

    expect(mockShowBrowserNotification).toHaveBeenCalledWith('Title', 'Body');
  });
});
