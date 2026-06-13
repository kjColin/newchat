import { apiClient } from '../../shared/api/client';
import type { User } from '../auth/types';
import type { SearchUser } from './types';

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
