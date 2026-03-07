import { ipc } from './ipcClient';
import { getAuthContext } from './session';

export const addExpense = (p: unknown) => ipc.expenses.add({ ...getAuthContext(), expense: p });
export const listExpenses = (f: string, t: string) => ipc.expenses.list({ ...getAuthContext(), from: f, to: t });
