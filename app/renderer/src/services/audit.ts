import { ipc } from './ipcClient';
import { getAuthContext } from './session';

export const listAudit = (filters: unknown) => ipc.audit.list({ ...getAuthContext(), filters });
