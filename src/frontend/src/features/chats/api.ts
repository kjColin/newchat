import { apiClient } from '../../shared/api/client';
import type {
  Attachment,
  AttachmentsResponse,
  Conversation,
  GroupMember,
  InviteLink,
  InvitePreview,
  Message,
  MessageSearchResponse,
  MessagesResponse,
  PinnedMessage,
  PinnedMessagesResponse,
} from './types';

export async function getConversations() {
  const { data } = await apiClient.get<Conversation[]>('/conversations');
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
  const { data } = await apiClient.post<Conversation>('/conversations/direct', { userId });
  return data;
}

export async function getMessages(
  conversationId: string,
  cursor?: { beforeCreatedAt?: string; beforeId?: string; limit?: number },
) {
  const { data } = await apiClient.get<MessagesResponse>(`/messages/${conversationId}`, {
    params: cursor,
  });
  return data;
}

export async function sendMessage(
  conversationId: string,
  content: string,
  options: { clientId?: string; replyToId?: string; forwardFromId?: string; attachmentIds?: string[]; type?: string } = {},
) {
  const { data } = await apiClient.post<Message>('/messages', {
    conversationId,
    content,
    ...options,
  });
  return data;
}

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await apiClient.post<Attachment>('/files', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function forwardMessage(messageId: string, conversationId: string, clientId?: string) {
  const { data } = await apiClient.post<Message>(`/messages/${messageId}/forward`, {
    conversationId,
    clientId,
  });
  return data;
}

export async function searchMessages(conversationId: string, query: string) {
  const { data } = await apiClient.get<MessageSearchResponse>(`/messages/${conversationId}/search`, {
    params: { q: query },
  });
  return data;
}

export async function getConversationAttachments(
  conversationId: string,
  options: { kind?: string; limit?: number; beforeCreatedAt?: string; beforeId?: string } = {},
) {
  const { data } = await apiClient.get<AttachmentsResponse>(`/messages/${conversationId}/attachments`, {
    params: options,
  });
  return data;
}

export async function getPinnedMessages(conversationId: string) {
  const { data } = await apiClient.get<PinnedMessage[]>(`/messages/${conversationId}/pinned`);
  return data;
}

export async function pinMessage(messageId: string) {
  const { data } = await apiClient.post<PinnedMessagesResponse>(`/messages/${messageId}/pin`);
  return data;
}

export async function unpinMessage(conversationId: string, messageId: string) {
  const { data } = await apiClient.delete<PinnedMessagesResponse>(`/messages/${conversationId}/pinned/${messageId}`);
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
  const { data } = await apiClient.patch<Conversation[]>(`/conversations/${conversationId}/settings`, settings);
  return data;
}

export async function updateGroup(conversationId: string, payload: { name?: string; avatar?: string; announcement?: string }) {
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

export async function getGroupInviteLinks(conversationId: string) {
  const { data } = await apiClient.get<InviteLink[]>(`/groups/${conversationId}/invites`);
  return data;
}

export async function createGroupInviteLink(conversationId: string) {
  const { data } = await apiClient.post<InviteLink>(`/groups/${conversationId}/invites`);
  return data;
}

export async function revokeGroupInviteLink(conversationId: string, inviteId: string) {
  const { data } = await apiClient.delete<InviteLink>(`/groups/${conversationId}/invites/${inviteId}`);
  return data;
}

export async function previewInviteLink(code: string) {
  const { data } = await apiClient.get<InvitePreview>(`/groups/invites/${code}`);
  return data;
}

export async function joinGroupByInvite(code: string) {
  const { data } = await apiClient.post<Conversation>(`/groups/invites/${code}/join`);
  return data;
}
