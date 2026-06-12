import type { User } from './types';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export const authStore = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser(): User | null {
    const value = localStorage.getItem(USER_KEY);
    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  },

  setSession(token: string, user: User) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isAuthenticated() {
    return Boolean(localStorage.getItem(TOKEN_KEY) && localStorage.getItem(USER_KEY));
  },
};
