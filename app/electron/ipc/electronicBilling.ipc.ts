import { ipcMain } from 'electron';
import {
  getElectronicBillingSettingsMySql,
  upsertElectronicBillingSettingsMySql,
} from '../db/mysql/electronicBilling.mysql';

export const registerElectronicBillingIpc = () => {
  ipcMain.handle('electronicBilling:get', async () => {
    return await getElectronicBillingSettingsMySql();
  });

  ipcMain.handle('electronicBilling:set', async (_e, data) => {
    await upsertElectronicBillingSettingsMySql(data);
    return { ok: true };
  });
};