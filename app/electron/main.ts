import 'dotenv/config';
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

import { getDb, getDbMode } from './db/db';

import { registerAuthIpc } from './ipc/auth.ipc';
import { registerProductsIpc } from './ipc/products.ipc';
import { registerSalesIpc } from './ipc/sales.ipc';
import { registerExpensesIpc } from './ipc/expenses.ipc';
import { registerReportsIpc } from './ipc/reports.ipc';
import { ensureDailyBackup, registerBackupsIpc } from './ipc/backups.ipc';
import { registerCashIpc } from './ipc/cash.ipc';
import { registerUsersIpc } from './ipc/users.ipc';
import { registerAuditIpc } from './ipc/audit.ipc';
import { registerMySqlIpc } from './ipc/mysql.ipc';
import { registerConfigIpc } from './ipc/config.ipc';
import { registerCashDrawerIpc } from './ipc/cashdrawer.ipc';
import {
  activateOnline,
  checkOnline,
  getMachineId,
  getSavedLicenseKey,
  licenseStatusLocal,
} from './license/license';
import { registerInstallerIpc }  from './ipc/installer.ipc';
import { registerAutoDetectIpc } from './ipc/autodetect.ipc';

console.log('[MAIN] Electron arrancó desde:', __filename);

let mainWindow: BrowserWindow | null = null;

const createWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;

  if (devUrl) {
    await mainWindow.loadURL(devUrl);
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'renderer', 'index.html');
    await mainWindow.loadFile(indexPath);
  }
};

// -------------------- LICENCIAS --------------------

ipcMain.handle('license:status', async () => {
  const machineId = getMachineId();
  const local = licenseStatusLocal();

  return {
    ok: local.ok,
    reason: local.reason,
    machineId,
    plan: local.state.plan ?? null,
    expiresAt: local.state.expiresAt ?? null,
    lastCheckAt: local.state.lastCheckAt ?? null,
    graceDays: local.state.graceDays ?? 7,
    hasLicense: !!getSavedLicenseKey(),
  };
});

ipcMain.handle('license:activate', async (_e, { licenseKey }) => {
  return await activateOnline(String(licenseKey ?? '').trim());
});

ipcMain.handle('license:check-online', async () => {
  const key = getSavedLicenseKey();
  if (!key) return { ok: false, message: 'NO_LICENSE' };
  return await checkOnline();
});

// -------------------- APP READY --------------------

app.whenReady().then(async () => {
  registerAutoDetectIpc();
  registerInstallerIpc();
  registerMySqlIpc();
  registerCashDrawerIpc();

  getDb();

  registerAuthIpc();
  registerProductsIpc();
  registerSalesIpc();
  registerExpensesIpc();
  registerReportsIpc();
  registerBackupsIpc();
  registerCashIpc();
  registerUsersIpc();
  registerAuditIpc();
  registerConfigIpc();

  await ensureDailyBackup();
  await createWindow();

  setInterval(async () => {
    console.log('DB MODE:', await getDbMode());
  }, 3000);
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});