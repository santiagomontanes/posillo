import { BrowserWindow, ipcMain } from 'electron';
import { requirePermissionFromPayload } from './rbac';
import { generateInvoicePdf } from '../invoice/invoicePdf';
import { createSaleRepo, updateSaleElectronicInvoiceRepo } from '../db/sales.repo';
import { logAuditRepo } from '../db/audit.repo';
import { getDbMode } from '../db/db';
import {
  buildFactusEventPersistenceData,
  buildFactusPersistenceData,
  factusCreateCreditNoteFromSale,
  factusCreateDebitNoteFromSale,
  factusCreateInvoiceFromSale,
} from '../invoice/factus.service';

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
  returnSaleMySql,
  createElectronicInvoiceEventMySql,
  listElectronicInvoiceEventsBySaleMySql,
} from '../db/mysql/sales.mysql';

import { getElectronicBillingSettingsMySql } from '../db/mysql/electronicBilling.mysql';

const getFactusCfgOrThrow = async () => {
  const eb = await getElectronicBillingSettingsMySql();

  if (!eb || !eb.enabled) {
    throw new Error('Facturación electrónica deshabilitada');
  }

  return {
    baseUrl: eb.base_url,
    username: eb.username,
    password: eb.password,
    clientId: eb.client_id,
    clientSecret: eb.client_secret,
  };
};

export const registerSalesIpc = (): void => {
  console.log('[SALES IPC] registerSalesIpc OK');

  ipcMain.handle('sales:create', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const salePayload = (payload as any)?.sale ?? payload;
    const result = await createSaleRepo(salePayload);
    const mode = await getDbMode();

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
            generateElectronicInvoice: Boolean(salePayload?.generateElectronicInvoice),
          },
        });
      } catch (err) {
        console.warn('[audit] SALE_CREATE failed:', err);
      }
    }

    let factus: any = null;
    let factusError: string | null = null;

    if (mode === 'mysql' && salePayload?.generateElectronicInvoice === true) {
      try {
        const cfg = await getFactusCfgOrThrow();

        factus = await factusCreateInvoiceFromSale(cfg, {
          saleId: result.saleId,
          invoiceNumber: result.invoiceNumber,
          paymentMethod: salePayload?.paymentMethod,
          customerName: salePayload?.customerName,
          customerId: salePayload?.customerId,
          customerEmail: salePayload?.customerEmail,
          customerPhone: salePayload?.customerPhone,
          customerAddress: salePayload?.customerAddress,
          total: salePayload?.total,
          items: salePayload?.items ?? [],
        });

        await updateSaleElectronicInvoiceRepo({
          saleId: result.saleId,
          ...buildFactusPersistenceData(factus),
        });
      } catch (err: any) {
        console.error('[FACTUS SEND ERROR]', err);
        factusError = err?.message || 'No se pudo enviar la factura electrónica.';

        try {
          await updateSaleElectronicInvoiceRepo({
            saleId: result.saleId,
            factusStatus: 'ERROR',
            factusBillId: null,
            factusBillNumber: null,
            factusPublicUrl: null,
            factusCufe: null,
            factusValidatedAt: null,
            factusError,
            factusRawJson: null,
          });
        } catch (persistErr) {
          console.warn('[FACTUS ERROR SAVE FAILED]', persistErr);
        }
      }
    }

    const pdf = await generateInvoicePdf({
      ...salePayload,
      invoiceNumber: result.invoiceNumber,
    });

    return {
      ...result,
      pdf,
      factus,
      factusError,
    };
  });

  ipcMain.handle('sales:credit-note:create', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const mode = await getDbMode();
    if (mode !== 'mysql') throw new Error('Notas electrónicas solo disponibles en MySQL.');

    const saleId = String((payload as any)?.saleId ?? '');
    const reasonCode = String((payload as any)?.reasonCode ?? '1');
    const reasonText = String((payload as any)?.reasonText ?? 'Nota crédito generada desde POS');
    const modeType = String((payload as any)?.mode ?? 'full') as 'full' | 'partial';
    const amount = Number((payload as any)?.amount ?? 0);

    const sale = await getSaleDetailMySql(saleId);
    if (!sale) throw new Error('Venta no encontrada.');
    if (!sale?.factus_bill_id) throw new Error('La venta no tiene factura electrónica asociada.');

    const cfg = await getFactusCfgOrThrow();

    const response = await factusCreateCreditNoteFromSale(cfg, {
      saleId,
      sale,
      reasonCode,
      reasonText,
      mode: modeType,
      amount,
    });

    const persisted = buildFactusEventPersistenceData(response);

    const eventId = await createElectronicInvoiceEventMySql({
      saleId,
      relatedSaleId: saleId,
      eventType: 'CREDIT_NOTE',
      status: 'OK',
      provider: 'factus',
      providerDocumentId: persisted.providerDocumentId,
      providerNumber: persisted.providerNumber,
      providerPublicUrl: persisted.providerPublicUrl,
      cufe: persisted.cufe,
      relatedProviderDocumentId: sale?.factus_bill_id ? Number(sale.factus_bill_id) : null,
      relatedProviderNumber: sale?.factus_bill_number ? String(sale.factus_bill_number) : null,
      reasonCode,
      reasonText,
      amount: modeType === 'partial' ? amount : Number(sale?.total ?? 0),
      payloadJson: JSON.stringify({
        saleId,
        reasonCode,
        reasonText,
        mode: modeType,
        amount,
      }),
      responseJson: persisted.responseJson,
      errorText: null,
    });

    return {
      ok: true,
      eventId,
      data: response,
    };
  });

  ipcMain.handle('sales:debit-note:create', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const mode = await getDbMode();
    if (mode !== 'mysql') throw new Error('Notas electrónicas solo disponibles en MySQL.');

    const saleId = String((payload as any)?.saleId ?? '');
    const reasonCode = String((payload as any)?.reasonCode ?? '4');
    const reasonText = String((payload as any)?.reasonText ?? 'Nota débito generada desde POS');
    const amount = Number((payload as any)?.amount ?? 0);

    const sale = await getSaleDetailMySql(saleId);
    if (!sale) throw new Error('Venta no encontrada.');
    if (!sale?.factus_bill_id) throw new Error('La venta no tiene factura electrónica asociada.');

    const cfg = await getFactusCfgOrThrow();

    const response = await factusCreateDebitNoteFromSale(cfg, {
      saleId,
      sale,
      reasonCode,
      reasonText,
      mode: 'partial',
      amount,
    });

    const persisted = buildFactusEventPersistenceData(response);

    const eventId = await createElectronicInvoiceEventMySql({
      saleId,
      relatedSaleId: saleId,
      eventType: 'DEBIT_NOTE',
      status: 'OK',
      provider: 'factus',
      providerDocumentId: persisted.providerDocumentId,
      providerNumber: persisted.providerNumber,
      providerPublicUrl: persisted.providerPublicUrl,
      cufe: persisted.cufe,
      relatedProviderDocumentId: sale?.factus_bill_id ? Number(sale.factus_bill_id) : null,
      relatedProviderNumber: sale?.factus_bill_number ? String(sale.factus_bill_number) : null,
      reasonCode,
      reasonText,
      amount,
      payloadJson: JSON.stringify({
        saleId,
        reasonCode,
        reasonText,
        amount,
      }),
      responseJson: persisted.responseJson,
      errorText: null,
    });

    return {
      ok: true,
      eventId,
      data: response,
    };
  });

  ipcMain.handle('sales:electronic-events', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const mode = await getDbMode();
    if (mode !== 'mysql') return [];

    const saleId = String((payload as any)?.saleId ?? '');
    return await listElectronicInvoiceEventsBySaleMySql(saleId);
  });

  ipcMain.handle('sales:print-invoice', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const html =
      typeof payload === 'string'
        ? payload
        : String((payload as any)?.html ?? '');

    const win = new BrowserWindow({
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        sandbox: false,
      },
    });

    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      await new Promise((resolve) => setTimeout(resolve, 350));

      await new Promise<void>((resolve, reject) => {
        win.webContents.print(
          {
            silent: false,
            printBackground: true,
            margins: {
              marginType: 'none',
            },
            pageSize: {
              width: 80000,
              height: 200000,
            },
          } as any,
          (success, failureReason) => {
            if (!success) {
              reject(new Error(failureReason || 'No se pudo imprimir la factura.'));
              return;
            }
            resolve();
          },
        );
      });

      return { ok: true };
    } finally {
      if (!win.isDestroyed()) {
        win.close();
      }
    }
  });

  ipcMain.handle('sales:suspend', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const sale = (payload as any)?.sale ?? payload;
    const mode = await getDbMode();

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

    if (mode === 'mysql') {
      return await listSuspendedSalesMySql();
    }

    return listSuspendedSales();
  });

  ipcMain.handle('sales:suspended-get', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const id = String((payload as any)?.id ?? '');
    const mode = await getDbMode();

    if (mode === 'mysql') {
      return await getSuspendedSaleMySql(id);
    }

    return getSuspendedSale(id);
  });

  ipcMain.handle('sales:suspended-delete', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const id = String((payload as any)?.id ?? '');
    const mode = await getDbMode();

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

    if (mode === 'mysql') {
      return await listRecentSalesMySql(limit);
    }

    return listRecentSales(limit);
  });

  ipcMain.handle('sales:detail', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const id = String((payload as any)?.id ?? '');
    const mode = await getDbMode();

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