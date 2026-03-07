import { ipcMain } from 'electron';
import { isMySqlEnabled } from '../db/dbRouter';
import { authUserMySql } from '../db/mysql/auth.mysql';
import { authUser } from '../db/queries'; // tu SQLite

export const registerAuthIpc = (): void => {
  ipcMain.handle('auth:login', async (_e, email: string, password: string) => {
    const user = isMySqlEnabled()
      ? await authUserMySql(email, password)
      : authUser(email, password);

    if (!user) throw new Error('Credenciales inválidas');
    return user;
  });
};