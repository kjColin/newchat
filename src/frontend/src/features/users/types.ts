import type { User } from '../auth/types';

export type SearchUser = Pick<User, 'id' | 'username' | 'email' | 'avatar' | 'status' | 'lastSeen'>;
