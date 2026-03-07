import { ipcMain } from 'electron';
import fs from 'node:fs';
import {
  getMySqlConfigPath,
  readMySqlConfig,
  writeMySqlConfig,
  type MySqlConfig,
} from '../db/mysqlConfig';
import { testMySqlConnection } from '../db/mysql';
import { initMySqlSchema } from '../db/mysql/initSchema.mysql';

export const registerMySqlIpc = (): void => {
  // ✅ Log para confirmar que este archivo sí se está ejecutando
  console.log('[MYSQL IPC] registerMySqlIpc OK ✅');

  ipcMain.handle('mysql:config:get', async () => {
    return readMySqlConfig();
  });

  ipcMain.handle('mysql:config:set', async (_e, cfg: MySqlConfig) => {
    // ✅ Validación rápida para evitar guardar basura
    if (!cfg?.host || !cfg?.user || !cfg?.database) {
      throw new Error('Config MySQL incompleta (host/user/database son obligatorios)');
    }

    const safeCfg: MySqlConfig = {
      host: String(cfg.host).trim(),
      port: Number(cfg.port ?? 3306),
      user: String(cfg.user).trim(),
      password: String(cfg.password ?? ''),
      database: String(cfg.database).trim(),
    };

    writeMySqlConfig(safeCfg);

    return { ok: true, path: getMySqlConfigPath() };
  });

  ipcMain.handle('mysql:config:clear', async () => {
    const p = getMySqlConfigPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { ok: true };
  });

  ipcMain.handle('mysql:test', async () => {
    return await testMySqlConnection();
  });

  // ✅ NUEVO: crear DB + tablas + admin
  ipcMain.handle('mysql:init-schema', async () => {
    console.log('[MYSQL IPC] mysql:init-schema llamado ✅');
    return await initMySqlSchema();
  });

  // ✅ Log de confirmación de handlers
  console.log('[MYSQL IPC] Handlers registrados: config:get, config:set, config:clear, test, init-schema ✅');
};