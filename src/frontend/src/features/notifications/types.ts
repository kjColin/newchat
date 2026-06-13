export type NotificationItem = {
  id: string;
  conversationId: string;
  messageId?: string | null;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type BrowserNotificationState = 'unsupported' | 'default' | 'granted' | 'denied';
