import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation } from '../chats/types';
import {
  clearNotifications as clearStoredNotifications,
  getNotifications,
  getPushPublicKey,
  markAllNotificationsRead as markAllStoredNotificationsRead,
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
import type { BrowserNotificationState, NotificationItem } from './types';

type UseNotificationsOptions = {
  activeConversationId: string | null;
  conversations: Conversation[];
  onSelectConversation: (conversation: Conversation) => Promise<void>;
};

export function useNotifications({
  activeConversationId,
  conversations,
  onSelectConversation,
}: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [browserNotificationState, setBrowserNotificationState] = useState<BrowserNotificationState>(() => getBrowserNotificationState());
  const activeConversationIdRef = useRef(activeConversationId);

  const unreadNotificationCount = useMemo(
    () => notifications.filter(notification => !notification.read).length,
    [notifications],
  );

  useEffect(() => {
    getNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, []);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const markConversationNotificationsLocalRead = useCallback((conversationId: string) => {
    setNotificationsOpen(false);
    setNotifications(prev => prev.map(notification =>
      notification.conversationId === conversationId ? { ...notification, read: true } : notification
    ));
    markConversationNotificationsRead(conversationId).catch(() => undefined);
  }, []);

  const receiveNotification = useCallback((notification: NotificationItem) => {
    const nextNotification = activeConversationIdRef.current === notification.conversationId
      ? { ...notification, read: true }
      : notification;
    if (nextNotification.read) {
      markConversationNotificationsRead(notification.conversationId).catch(() => undefined);
    }

    setNotifications(prev => {
      const next = [nextNotification, ...prev.filter(item => item.id !== notification.id)];
      return next.slice(0, 30);
    });
  }, []);

  const enableBrowserNotifications = useCallback(async () => {
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
      // Foreground browser notifications still work when Web Push is unavailable.
    }
  }, []);

  const selectNotification = useCallback(async (notification: NotificationItem) => {
    setNotifications(prev => prev.map(item => item.id === notification.id ? { ...item, read: true } : item));
    markNotificationRead(notification.id).catch(() => undefined);
    const conversation = conversations.find(item => item.id === notification.conversationId);
    if (conversation) {
      await onSelectConversation(conversation);
    }
  }, [conversations, onSelectConversation]);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(notification => ({ ...notification, read: true })));
    markAllStoredNotificationsRead().catch(() => undefined);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setNotificationsOpen(false);
    clearStoredNotifications().catch(() => undefined);
  }, []);

  return {
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
  };
}
