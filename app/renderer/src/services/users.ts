import { ipc } from './ipcClient';
import { getAuthContext } from './session';

export const listUsers = () => ipc.users.list(getAuthContext());
export const createUser = (user: unknown) => ipc.users.create({ ...getAuthContext(), user });
export const resetUserPassword = (data: unknown) => ipc.users.resetPassword({ ...getAuthContext(), data });

export const listUsersBasic = () => ipc.users.listBasic(getAuthContext());
