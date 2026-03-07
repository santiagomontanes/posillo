import type { User } from '../types';

let currentUser: User | null = null;

export const setSessionUser = (user: User | null): void => {
  currentUser = user;
};

export const getSessionUser = (): User | null => currentUser;

export const getAuthContext = (): { userId: string; role: 'ADMIN' | 'SUPERVISOR' | 'SELLER' } => {
  if (!currentUser) throw new Error('No autorizado');
  return { userId: currentUser.id, role: currentUser.role };
};
