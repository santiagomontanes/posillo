import { ipcMain } from 'electron';
import { requirePermissionFromPayload } from './rbac';
import { addExpenseRepo, listExpensesRepo } from '../db/expenses.repo';
import { logAuditRepo } from '../db/audit.repo';

export const registerExpensesIpc = (): void => {

  // evitar doble registro en modo dev
  ipcMain.removeHandler('expenses:add');
  ipcMain.removeHandler('expenses:list');

  ipcMain.handle('expenses:add', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'expenses:write');

    const expense = (payload as any)?.expense ?? payload;

    const actorId = String((payload as any)?.userId ?? expense?.userId ?? '');

    const id = await addExpenseRepo(expense);

    if (actorId) {
      await logAuditRepo({
        actorId,
        action: 'EXPENSE_CREATE',
        entityType: 'EXPENSE',
        entityId: id,
        metadata: {
          concept: expense?.concept,
          amount: expense?.amount,
          date: expense?.date,
        },
      });
    }

    return id;
  });

  ipcMain.handle('expenses:list', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'expenses:read');

    const from = String((payload as any)?.from ?? '');
    const to = String((payload as any)?.to ?? '');

    // 👇 CORRECCIÓN IMPORTANTE
    return await listExpensesRepo(from, to );
  });
};