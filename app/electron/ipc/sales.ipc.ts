import { BrowserWindow, ipcMain, shell } from 'electron';
import { requirePermissionFromPayload } from './rbac';
import { generateInvoicePdf } from '../invoice/invoicePdf';
import { createSaleRepo } from '../db/sales.repo';
import { logAuditRepo } from '../db/audit.repo';
import { getDbMode } from '../db/db';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  suspendSale,
  listSuspendedSales,
  getSuspendedSale,
  deleteSuspendedSale,
  listRecentSales,
  getSaleDetail,
} from '../db/queries';

import {
  suspendSaleMySql,
  listSuspendedSalesMySql,
  getSuspendedSaleMySql,
  deleteSuspendedSaleMySql,
  listRecentSalesMySql,
  getSaleDetailMySql,
} from '../db/mysql/sales.mysql';

import { returnSaleMySql } from '../db/mysql/sales.mysql';

export const registerSalesIpc = (): void => {
  console.log('[SALES IPC] registerSalesIpc OK');

  ipcMain.handle('sales:create', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const salePayload = (payload as any)?.sale ?? payload;
    const result = await createSaleRepo(salePayload);

    const actorId = String((payload as any)?.userId ?? salePayload?.userId ?? '');
    if (actorId) {
      try {
        await logAuditRepo({
          actorId,
          action: 'SALE_CREATE',
          entityType: 'SALE',
          entityId: result.saleId,
          metadata: {
            invoiceNumber: result.invoiceNumber,
            total: salePayload?.total,
            paymentMethod: salePayload?.paymentMethod,
          },
        });
      } catch (err) {
        console.warn('[audit] SALE_CREATE failed:', err);
      }
    }

    const pdf = await generateInvoicePdf({
      ...salePayload,
      invoiceNumber: result.invoiceNumber,
    });

    return { ...result, pdf };
  });

  ipcMain.handle('sales:print-invoice', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const html = typeof payload === 'string' ? payload : String((payload as any)?.html ?? '');

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false,
      },
    });

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    const tempDir = path.join(os.tmpdir(), 'sistetecni-pos');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const filePath = path.join(tempDir, `factura-${Date.now()}.pdf`);

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });

    fs.writeFileSync(filePath, pdfBuffer);

    const openRes = await shell.openPath(filePath);
    if (openRes) {
      console.warn('[pdf] openPath error:', openRes);
    }

    win.webContents.print({ silent: false });

    win.close();
    return { ok: true, filePath };
  });

  ipcMain.handle('sales:suspend', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const sale = (payload as any)?.sale ?? payload;
    const mode = await getDbMode();

    console.log('[sales:suspend] mode =', mode);

    if (mode === 'mysql') {
      const id = await suspendSaleMySql(sale);
      return { ok: true, id };
    }

    const id = suspendSale(sale);
    return { ok: true, id };
  });

  ipcMain.handle('sales:suspended-list', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const mode = await getDbMode();
    console.log('[sales:suspended-list] mode =', mode);

    if (mode === 'mysql') {
      return await listSuspendedSalesMySql();
    }

    return listSuspendedSales();
  });

  ipcMain.handle('sales:suspended-get', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const id = String((payload as any)?.id ?? '');
    const mode = await getDbMode();

    console.log('[sales:suspended-get] mode =', mode);

    if (mode === 'mysql') {
      return await getSuspendedSaleMySql(id);
    }

    return getSuspendedSale(id);
  });

  ipcMain.handle('sales:suspended-delete', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const id = String((payload as any)?.id ?? '');
    const mode = await getDbMode();

    console.log('[sales:suspended-delete] mode =', mode);

    if (mode === 'mysql') {
      await deleteSuspendedSaleMySql(id);
      return { ok: true };
    }

    deleteSuspendedSale(id);
    return { ok: true };
  });

  ipcMain.handle('sales:recent', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const limit = Number((payload as any)?.limit ?? 30);
    const mode = await getDbMode();

    console.log('[sales:recent] mode =', mode);

    if (mode === 'mysql') {
      return await listRecentSalesMySql(limit);
    }

    return listRecentSales(limit);
  });

  ipcMain.handle('sales:detail', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const id = String((payload as any)?.id ?? '');
    const mode = await getDbMode();

    console.log('[sales:detail] mode =', mode);

    if (mode === 'mysql') {
      return await getSaleDetailMySql(id);
    }

    return getSaleDetail(id);
  });

  ipcMain.handle('sales:return', async (_e, payload) => {

  requirePermissionFromPayload(payload, 'pos:sell');

  const mode = await getDbMode();

  if (mode === 'mysql') {

    return await returnSaleMySql(payload);

  }

  throw new Error('Return sale only implemented for MySQL.');

});


};