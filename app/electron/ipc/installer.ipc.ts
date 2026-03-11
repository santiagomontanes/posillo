/**
 * installer.ipc.ts
 * ================
 * Handlers IPC para el wizard de instalación.
 */

import { ipcMain, BrowserWindow } from 'electron';
import {
  runInstaller,
  checkDbInstalled,
  type InstallProgress,
} from '../db/dbInstaller';
import { writeMySqlConfig, readMySqlConfig } from '../db/mysqlConfig';
import { testMySqlConnection } from '../db/mysql';
import type { MySqlConfig } from '../db/mysqlConfig';

export const registerInstallerIpc = (): void => {
  ipcMain.handle('installer:test-connection', async (_e, cfg: MySqlConfig) => {
    return await testMySqlConnection(cfg);
  });

  ipcMain.handle('installer:check', async () => {
    const cfg = readMySqlConfig();
    if (!cfg) return { installed: false, reason: 'Sin configuración MySQL' };
    return await checkDbInstalled(cfg);
  });

  ipcMain.handle(
    'installer:run',
    async (
      event,
      payload: {
        mysql: MySqlConfig;
        adminName: string;
        adminEmail: string;
        adminPassword: string;
        companyName?: string;
      },
    ) => {
      writeMySqlConfig(payload.mysql);

      const win = BrowserWindow.fromWebContents(event.sender);

      const result = await runInstaller({
        ...payload,
        onProgress: (p: InstallProgress) => {
          win?.webContents.send('installer:progress', p);
        },
      });

      return result;
    },
  );

  console.log('[ipc] installer handlers registrados ✅');
};