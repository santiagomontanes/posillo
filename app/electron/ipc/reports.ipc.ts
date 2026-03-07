import { ipcMain } from 'electron';
import { requirePermissionFromPayload } from './rbac';
import {
  getLast7DaysSalesRepo,
  getTodaySummaryRepo,
  reportSalesByDayRepo,
  reportSummaryRepo,
  reportTopProductsRepo,
  reportDailyCloseRepo,
} from '../db/reports.repo';

const ymd = (s: any) => String(s ?? '').trim().slice(0, 10);

export const registerReportsIpc = (): void => {
  ipcMain.handle('reports:daily-close', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'reports:read');

    // ✅ Soporta {from,to} o {date}
    const fromRaw = ymd((payload as any)?.from ?? (payload as any)?.date);
    const toRaw = ymd((payload as any)?.to ?? (payload as any)?.date);

    // Si no mandan nada, usa hoy (YYYY-MM-DD)
    const today = new Date().toISOString().slice(0, 10);
    const from = fromRaw || today;
    const to = toRaw || from;

    return await reportDailyCloseRepo(from, to);
  });

  ipcMain.handle('reports:sales-by-day', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'reports:read');
    return await reportSalesByDayRepo(String((payload as any)?.from ?? ''), String((payload as any)?.to ?? ''));
  });

  ipcMain.handle('reports:top-products', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'reports:read');
    return await reportTopProductsRepo(String((payload as any)?.from ?? ''), String((payload as any)?.to ?? ''));
  });

  ipcMain.handle('reports:summary', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'reports:read');
    return await reportSummaryRepo(String((payload as any)?.from ?? ''), String((payload as any)?.to ?? ''));
  });

  ipcMain.handle('reports:today-summary', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'reports:read');
    return await getTodaySummaryRepo();
  });

  ipcMain.handle('reports:last-7-days-sales', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'reports:read');
    return await getLast7DaysSalesRepo();
  });
};