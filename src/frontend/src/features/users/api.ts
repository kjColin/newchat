import { apiClient } from '../../shared/api/client';
import type { SearchUser } from './types';

export async function searchUsers(query: string) {
  if (query.trim().length < 2) return [];

  const { data } = await apiClient.get<SearchUser[]>('/users/search', {
    params: { q: query.trim() },
  });
  return data;
}
