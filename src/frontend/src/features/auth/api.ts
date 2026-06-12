import { apiClient } from '../../shared/api/client';
import type { AuthResponse, LoginPayload, RegisterPayload } from './types';

export async function login(payload: LoginPayload) {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function register(payload: RegisterPayload) {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
  return data;
}
