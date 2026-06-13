import { apiClient } from '../../shared/api/client';
import type { NotificationItem } from './types';

export async function getNotifications() {
  const { data } = await apiClient.get<NotificationItem[]>('/notifications');
  return data;
}

export async function markNotificationRead(notificationId: string) {
  const { data } = await apiClient.patch<{ updated: number }>(`/notifications/${notificationId}/read`);
  return data;
}

export async function markConversationNotificationsRead(conversationId: string) {
  const { data } = await apiClient.post<{ updated: number }>(`/notifications/conversations/${conversationId}/read`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await apiClient.post<{ updated: number }>('/notifications/read-all');
  return data;
}

export async function clearNotifications() {
  const { data } = await apiClient.delete<{ deleted: number }>('/notifications');
  return data;
}
