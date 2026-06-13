import type { User } from '../auth/types';

export type SearchUser = Pick<User, 'id' | 'username' | 'email' | 'avatar' | 'status' | 'lastSeen'> & {
  isContact?: boolean;
  isBlocked?: boolean;
};

export type ContactEntry = {
  user: SearchUser;
  alias?: string | null;
  createdAt: string;
};

export type BlockedUserEntry = {
  user: SearchUser;
  createdAt: string;
};
