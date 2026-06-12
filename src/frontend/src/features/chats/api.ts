import { apiClient } from '../../shared/api/client';
import type { Conversation, GroupMember, Message, MessagesResponse } from './types';

export async function getConversations() {
  const { data } = await apiClient.get<Conversation[]>('/groups');
  return data;
}

export async function createGroup(name: string, memberIds: string[]) {
  const { data } = await apiClient.post<Conversation>('/groups', {
    name,
    members: memberIds,
  });
  return data;
}

export async function createDirectConversation(userId: string) {
  const { data } = await apiClient.post<Conversation>('/groups/direct', { userId });
  return data;
}

export async function getMessages(conversationId: string) {
  const { data } = await apiClient.get<MessagesResponse>(`/messages/${conversationId}`);
  return data;
}

export async function sendMessage(conversationId: string, content: string) {
  const { data } = await apiClient.post<Message>('/messages', {
    conversationId,
    content,
  });
  return data;
}

export async function editMessage(messageId: string, content: string) {
  const { data } = await apiClient.patch<Message>(`/messages/${messageId}`, { content });
  return data;
}

export async function deleteMessage(messageId: string) {
  const { data } = await apiClient.delete<Message>(`/messages/${messageId}`);
  return data;
}

export async function toggleReaction(messageId: string, emoji: string) {
  const { data } = await apiClient.post<Message>(`/messages/${messageId}/reactions`, { emoji });
  return data;
}

export async function markConversationRead(conversationId: string) {
  const { data } = await apiClient.post<{ conversationId: string; userId: string; lastReadAt: string }>(`/messages/${conversationId}/read`);
  return data;
}

export async function updateConversationSettings(
  conversationId: string,
  settings: { pinned?: boolean; muted?: boolean; archived?: boolean },
) {
  const { data } = await apiClient.patch<Conversation[]>(`/groups/${conversationId}/settings`, settings);
  return data;
}

export async function updateGroup(conversationId: string, payload: { name?: string; avatar?: string }) {
  const { data } = await apiClient.patch<Conversation>(`/groups/${conversationId}`, payload);
  return data;
}

export async function getGroupMembers(conversationId: string) {
  const { data } = await apiClient.get<GroupMember[]>(`/groups/${conversationId}/members`);
  return data;
}

export async function addGroupMembers(conversationId: string, members: string[]) {
  const { data } = await apiClient.post<GroupMember[]>(`/groups/${conversationId}/members`, { members });
  return data;
}

export async function removeGroupMember(conversationId: string, userId: string) {
  const { data } = await apiClient.delete<GroupMember[]>(`/groups/${conversationId}/members/${userId}`);
  return data;
}
