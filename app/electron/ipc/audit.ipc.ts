import { ipcMain } from 'electron';
import { requirePermissionFromPayload } from './rbac';
import { listAuditLogsRepo } from '../db/audit.repo';
import type { AuditLogAction } from '../db/queries';

const isAuditLogAction = (v: any): v is AuditLogAction => {
  return [
    'USER_CREATE',
    'USER_RESET_PASSWORD',
    'SALE_CREATE',
    'SALE_VOID',
    'CASH_OPEN',
    'CASH_CLOSE',
    'PRODUCT_SAVE',
    'PRODUCT_UPDATE',
    'PRODUCT_DELETE',
    'BACKUP_CREATE',
    'EXPENSE_CREATE',
  ].includes(String(v));
};

export const registerAuditIpc = (): void => {
  ipcMain.handle('audit:list', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'audit:read');

    const from = String((payload as any)?.from ?? '');
    const to = String((payload as any)?.to ?? '');
    const actorId = (payload as any)?.actorId ? String((payload as any).actorId) : undefined;
    const actionRaw = (payload as any)?.action;
const action = isAuditLogAction(actionRaw) ? actionRaw : undefined;
    const limit = Math.max(1, Math.min(Number((payload as any)?.limit ?? 100), 500));
    const offset = Math.max(0, Number((payload as any)?.offset ?? 0));

    return await listAuditLogsRepo({ from, to, actorId, action, limit, offset });
  });
};