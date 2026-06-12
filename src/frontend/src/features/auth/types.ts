export type User = {
  id: string;
  username: string;
  email: string;
  avatar?: string | null;
  status?: string;
  lastSeen?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = LoginPayload & {
  username: string;
};
