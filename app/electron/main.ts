import 'dotenv/config';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';

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
import { registerInstallerIpc } from './ipc/installer.ipc';
import { registerAutoDetectIpc } from './ipc/autodetect.ipc';

console.log('[MAIN] Electron arrancó desde:', __filename);

let mainWindow: BrowserWindow | null = null;

const setupAutoUpdates = (): void => {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[UPDATER] Buscando actualizaciones...');
  });

  autoUpdater.on('update-available', async (info) => {
    console.log('[UPDATER] Actualización disponible:', info?.version);

    try {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Actualización disponible',
        message: `Se encontró una nueva versión (${info?.version ?? 'nueva'}).`,
        detail: 'La actualización se descargará automáticamente en segundo plano.',
        buttons: ['Aceptar'],
      });
    } catch {}
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[UPDATER] No hay actualizaciones disponibles.');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(
      `[UPDATER] Descargando ${Math.round(progress.percent)}% - ${Math.round(
        progress.bytesPerSecond / 1024,
      )} KB/s`,
    );
  });

  autoUpdater.on('update-downloaded', async (info) => {
    console.log('[UPDATER] Actualización descargada:', info?.version);

    try {
      const result = await dialog.showMessageBox({
        type: 'info',
        title: 'Actualización lista',
        message: `La versión ${info?.version ?? ''} ya fue descargada.`,
        detail: 'La aplicación se cerrará para instalar la actualización.',
        buttons: ['Actualizar ahora', 'Después'],
        defaultId: 0,
        cancelId: 1,
      });

      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    } catch (error) {
      console.error('[UPDATER] Error mostrando diálogo final:', error);
    }
  });

  autoUpdater.on('error', (error) => {
    console.error('[UPDATER] Error:', error);
  });
};

const checkForAppUpdates = async (): Promise<void> => {
  try {
    if (process.env.VITE_DEV_SERVER_URL) {
      console.log('[UPDATER] Modo desarrollo: se omite revisión de actualizaciones.');
      return;
    }

    await autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    console.error('[UPDATER] No se pudo revisar actualizaciones:', error);
  }
};

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

// -------------------- UPDATER IPC --------------------

ipcMain.handle('app:check-updates', async () => {
  try {
    if (process.env.VITE_DEV_SERVER_URL) {
      return { ok: false, message: 'DEV_MODE' };
    }

    const result = await autoUpdater.checkForUpdates();
    return {
      ok: true,
      updateInfo: result?.updateInfo ?? null,
    };
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || 'UPDATE_CHECK_FAILED',
    };
  }
});

ipcMain.handle('app:install-update', async () => {
  try {
    autoUpdater.quitAndInstall();
    return { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || 'INSTALL_UPDATE_FAILED',
    };
  }
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

  setupAutoUpdates();

  await ensureDailyBackup();
  await createWindow();
  await checkForAppUpdates();

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