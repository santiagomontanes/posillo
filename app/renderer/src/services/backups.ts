import { ipc } from './ipcClient';
import { getAuthContext } from './session';

export const createManualBackup = () => ipc.backups.createManual(getAuthContext());
export const exportBackup = () => ipc.backups.export(getAuthContext());
export const restoreBackup = () => ipc.backups.restore(getAuthContext());
