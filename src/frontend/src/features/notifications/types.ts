export type NotificationItem = {
  id: string;
  conversationId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type BrowserNotificationState = 'unsupported' | 'default' | 'granted' | 'denied';
