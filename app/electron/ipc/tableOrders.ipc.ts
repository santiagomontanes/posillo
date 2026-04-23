import { ipcMain } from 'electron';
import { requirePermissionFromPayload } from './rbac';
import {
  closeTableOrderRepo,
  createTableOrderRepo,
  getTableOrderRepo,
  listOpenTableOrdersRepo,
  saveTableOrderRepo,
} from '../db/tableOrders.repo';

export const registerTableOrdersIpc = (): void => {
  ipcMain.handle('tableOrders:list', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');
    return await listOpenTableOrdersRepo();
  });

  ipcMain.handle('tableOrders:create', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const tableName = String((payload as any)?.tableName ?? '').trim();
    if (!tableName) throw new Error('El nombre de la mesa es obligatorio.');

    const id = await createTableOrderRepo(tableName);
    return await getTableOrderRepo(id);
  });

  ipcMain.handle('tableOrders:get', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const id = String((payload as any)?.id ?? '').trim();
    if (!id) throw new Error('Mesa invÃ¡lida.');

    return await getTableOrderRepo(id);
  });

  ipcMain.handle('tableOrders:save', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const id = String((payload as any)?.id ?? '').trim();
    if (!id) throw new Error('Mesa invÃ¡lida.');

    await saveTableOrderRepo({
      id,
      tableName: String((payload as any)?.tableName ?? '').trim() || undefined,
      items: Array.isArray((payload as any)?.items) ? (payload as any).items : [],
      total: Number((payload as any)?.total ?? 0),
    });

    return { ok: true };
  });

  ipcMain.handle('tableOrders:close', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const id = String((payload as any)?.id ?? '').trim();
    if (!id) throw new Error('Mesa invÃ¡lida.');

    await closeTableOrderRepo(id);
    return { ok: true };
  });
};
