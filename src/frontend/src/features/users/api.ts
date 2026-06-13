import { apiClient } from '../../shared/api/client';
import type { User } from '../auth/types';
import type { BlockedUserEntry, ContactEntry, SearchUser } from './types';

export async function getCurrentUser() {
  const { data } = await apiClient.get<User>('/users/me');
  return data;
}

export async function updateCurrentUser(payload: { username?: string; avatar?: string }) {
  const { data } = await apiClient.patch<User>('/users/me', payload);
  return data;
}

export async function searchUsers(query: string) {
  if (query.trim().length < 2) return [];

  const { data } = await apiClient.get<SearchUser[]>('/users/search', {
    params: { q: query.trim() },
  });
  return data;
}

export async function getContacts() {
  const { data } = await apiClient.get<ContactEntry[]>('/users/contacts');
  return data;
}

export async function addContact(userId: string) {
  const { data } = await apiClient.post<ContactEntry[]>('/users/contacts', { userId });
  return data;
}

export async function removeContact(userId: string) {
  const { data } = await apiClient.delete<ContactEntry[]>(`/users/contacts/${userId}`);
  return data;
}

export async function getBlockedUsers() {
  const { data } = await apiClient.get<BlockedUserEntry[]>('/users/blocks');
  return data;
}

export async function blockUser(userId: string) {
  const { data } = await apiClient.post<BlockedUserEntry[]>('/users/blocks', { userId });
  return data;
}

export async function unblockUser(userId: string) {
  const { data } = await apiClient.delete<BlockedUserEntry[]>(`/users/blocks/${userId}`);
  return data;
}
