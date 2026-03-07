import { BrowserWindow, ipcMain, shell } from 'electron';
import { requirePermissionFromPayload } from './rbac';
import { generateInvoicePdf } from '../invoice/invoicePdf';
import { createSaleRepo } from '../db/sales.repo';
import { logAuditRepo } from '../db/audit.repo';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const registerSalesIpc = (): void => {
  ipcMain.handle('sales:create', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const salePayload = (payload as any)?.sale ?? payload;
    const result = await createSaleRepo(salePayload);

    // auditoría (MYSQL si está habilitado / si no, SQLite)
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

    const pdf = await generateInvoicePdf({ ...salePayload, invoiceNumber: result.invoiceNumber });
    return { ...result, pdf };
  });

  /**
   * Abre la factura como PDF en el visor del sistema (ventana emergente)
   * y (opcional) también lanza el diálogo de impresión.
   */
  ipcMain.handle('sales:print-invoice', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const html = typeof payload === 'string' ? payload : String((payload as any)?.html ?? '');

    // 1) Render invisible
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false,
      },
    });

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // 2) Generar PDF en temp
    const tempDir = path.join(os.tmpdir(), 'sistetecni-pos');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const filePath = path.join(tempDir, `factura-${Date.now()}.pdf`);

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });

    fs.writeFileSync(filePath, pdfBuffer);

    // 3) Abrir el PDF (visor predeterminado de Windows)
    const openRes = await shell.openPath(filePath);
    if (openRes) {
      // openPath devuelve string con error si falló
      console.warn('[pdf] openPath error:', openRes);
    }

    // 4) Opcional: también mostrar diálogo de impresión
    // Si NO quieres imprimir y SOLO abrir PDF, comenta esta línea:
    win.webContents.print({ silent: false });

    win.close();
    return { ok: true, filePath };
  });
};