import axios from 'axios';
import { authStore } from '../../features/auth/auth-store';

export const apiClient = axios.create({
  baseURL: '/api',
});

apiClient.interceptors.request.use(config => {
  const token = authStore.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      authStore.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
