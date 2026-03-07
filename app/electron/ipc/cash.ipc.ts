import { ipcMain } from 'electron';
import { createBackup } from './backups.ipc';
import { requirePermissionFromPayload } from './rbac';
import {
  closeCashRepo,
  getCashStatusRepo,
  getOpenCashRepo,
  getOpenSuggestionRepo,
  openCashRepo,
} from '../db/cash.repo';
import { logAuditRepo } from '../db/audit.repo';

export const registerCashIpc = (): void => {
  ipcMain.handle('cash:open', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'cash:openclose');
    const cashPayload = (payload as any)?.cash ?? payload;

    const id = await openCashRepo(cashPayload);

    const actorId = String((payload as any)?.userId ?? cashPayload?.userId ?? '');
    if (actorId) {
      try {
        await logAuditRepo({
          actorId,
          action: 'CASH_OPEN',
          entityType: 'CASH_SESSION',
          entityId: id,
          metadata: { openingCash: cashPayload?.openingCash, openingNotes: cashPayload?.openingNotes ?? '' },
        });
      } catch (err) {
        console.warn('[audit] CASH_OPEN failed:', err);
      }
    }

    return id;
  });

  ipcMain.handle('cash:get-open', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'cash:read');
    return await getOpenCashRepo();
  });

  ipcMain.handle('cash:get-status', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'cash:read');
    return await getCashStatusRepo();
  });

  ipcMain.handle('cash:get-open-suggestion', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'cash:read');
    return await getOpenSuggestionRepo();
  });

  ipcMain.handle('cash:close', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'cash:openclose');
    const cashPayload = (payload as any)?.cash ?? payload;

    const result = await closeCashRepo(cashPayload);

    const base = typeof result === 'object' && result !== null ? result : {};
    const actorId = String((payload as any)?.userId ?? cashPayload?.userId ?? '');

    if (actorId) {
      try {
        await logAuditRepo({
          actorId,
          action: 'CASH_CLOSE',
          entityType: 'CASH_SESSION',
          entityId: String(cashPayload?.id ?? ''),
          metadata: base,
        });
      } catch (err) {
        console.warn('[audit] CASH_CLOSE failed:', err);
      }
    }

    try {
      const backupPath = await createBackup('cash_close');
      return { ...base, backupPath };
    } catch {
      return { ...base, backupPath: null };
    }
  });
};