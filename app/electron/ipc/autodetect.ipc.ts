/**
 * autodetect.ipc.ts
 * =================
 * IPC handler para el autodetect de MySQL.
 * La UI React consulta el estado al arrancar.
 *
 * Registrar en main.ts:
 *   import { registerAutoDetectIpc } from './ipc/autodetect.ipc';
 *   registerAutoDetectIpc();
 */

import { ipcMain } from 'electron';
import { autoDetectAndConfigureMySQL } from '../db/mysql.autodetect';

// Cache del resultado para no repetir el proceso
let cachedResult: Awaited<ReturnType<typeof autoDetectAndConfigureMySQL>> | null = null;

export const registerAutoDetectIpc = (): void => {

  // La UI llama esto al arrancar para saber qué mostrar
  ipcMain.handle('autodetect:status', async () => {
    try {
      if (!cachedResult) {
        cachedResult = await autoDetectAndConfigureMySQL();
      }
      return { ok: true, data: cachedResult };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });

  // Resetear cache (útil si el usuario cambia la config manualmente)
  ipcMain.handle('autodetect:reset', () => {
    cachedResult = null;
    return { ok: true };
  });

  console.log('[ipc] autodetect handlers registrados ✅');
};
