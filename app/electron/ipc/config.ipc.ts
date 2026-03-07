import { ipcMain, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

type AppConfig = {
  dbMode?: 'sqlite' | 'mysql';
  mysql?: {
    host?: string;
    user?: string;
    password?: string;
    database?: string;
    port?: number;
  };
  business?: {
    name?: string;
    logoDataUrl?: string; // base64 data URL (png/jpg)
  };
};

const getConfigPath = () => path.join(app.getPath('userData'), 'config.json');

const readConfig = (): AppConfig => {
  const file = getConfigPath();
  if (!fs.existsSync(file)) return { dbMode: 'sqlite' };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as AppConfig;
  } catch {
    return { dbMode: 'sqlite' };
  }
};

// merge “suave” (mantiene lo que ya existe)
const mergeConfig = (current: AppConfig, patch: Partial<AppConfig>): AppConfig => {
  return {
    ...current,
    ...patch,
    mysql: { ...(current.mysql ?? {}), ...(patch.mysql ?? {}) },
    business: { ...(current.business ?? {}), ...(patch.business ?? {}) },
  };
};

export const registerConfigIpc = (): void => {
  ipcMain.handle('config:get', async () => {
    const cfg = readConfig();

    // si no existe, lo crea
    const file = getConfigPath();
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
    }
    return cfg;
  });

  ipcMain.handle('config:set', async (_event, patch: Partial<AppConfig>) => {
    const current = readConfig();
    const next = mergeConfig(current, patch);
    fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf-8');

    // Reinicio/recarga
    const win = BrowserWindow.getAllWindows()[0];
    if (process.env.VITE_DEV_SERVER_URL) {
      win?.reload();
    } else {
      app.relaunch();
      app.exit(0);
    }

    return { ok: true };
  });
};