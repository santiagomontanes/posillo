import { ipc } from './ipcClient';

export type Role = 'ADMIN' | 'SUPERVISOR' | 'SELLER';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword?: boolean; // ✅ nuevo
};

export const login = async (email: string, password: string): Promise<AuthUser> => {
  const u = await ipc.auth.login(email, password);
  return u as AuthUser;
};