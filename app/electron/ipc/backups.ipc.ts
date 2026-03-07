import fs from 'node:fs';
import path from 'node:path';
import { app, dialog, ipcMain } from 'electron';
import { getDb, getDbPath } from '../db/db';
import { logAudit } from '../db/queries';
import { requirePermissionFromPayload } from './rbac';

type BackupReason = 'manual' | 'daily' | 'cash_close';

const getBackupsDir = (): string => {
  const dir = path.join(app.getPath('userData'), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const backupName = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `sistetecni-pos-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}.db`;
};

const pruneBackups = (dir: string): void => {
  const backups = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ fullPath: path.join(dir, f), mtimeMs: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => a.mtimeMs - b.mtimeMs);

  const toDelete = backups.length - 30;
  if (toDelete <= 0) return;
  for (let i = 0; i < toDelete; i += 1) {
    try {
      fs.unlinkSync(backups[i].fullPath);
    } catch {
      // best effort prune, do not break app
    }
  }
};

export const createBackup = async (reason: BackupReason): Promise<string> => {
  try {
    const dir = getBackupsDir();
    const out = path.join(dir, backupName());
    await getDb().backup(out);
    pruneBackups(dir);
    return out;
  } catch (error) {
    console.error(`[backup:${reason}] failed`, error);
    throw error;
  }
};

export const ensureDailyBackup = async (): Promise<string | null> => {
  try {
    const dir = getBackupsDir();
    const today = new Date().toISOString().slice(0, 10);
    const alreadyHasToday = fs.readdirSync(dir).some((f) => f.includes(today) && f.endsWith('.db'));
    if (alreadyHasToday) return null;
    return await createBackup('daily');
  } catch (error) {
    console.error('[backup:daily-check] failed', error);
    return null;
  }
};

export const registerBackupsIpc = (): void => {
  ipcMain.handle('backup:create-manual', async (_e, payload) => {
    try {
      requirePermissionFromPayload(payload, 'backup:write');
      const out = await createBackup('manual');
      const actorId = String((payload as any)?.userId ?? '');
      if (actorId) logAudit({ actorId, action: 'BACKUP_CREATE', entityType: 'BACKUP', entityId: out, metadata: { reason: 'manual' } });
      return out;
    } catch {
      return null;
    }
  });

  ipcMain.handle('backups:export', async (_e, payload) => {
    try {
      requirePermissionFromPayload(payload, 'backup:write');
      const target = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
      if (target.canceled || !target.filePaths[0]) return null;
      const out = path.join(target.filePaths[0], backupName());
      fs.copyFileSync(getDbPath(), out);
      return out;
    } catch (error) {
      console.error('[backup:export] failed', error);
      return null;
    }
  });

  ipcMain.handle('backups:restore', async (_e, payload) => {
    try {
      requirePermissionFromPayload(payload, 'backup:write');
      const file = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'SQLite DB', extensions: ['db'] }] });
      if (file.canceled || !file.filePaths[0]) return false;
      fs.copyFileSync(file.filePaths[0], getDbPath());
      return true;
    } catch (error) {
      console.error('[backup:restore] failed', error);
      return false;
    }
  });
};
