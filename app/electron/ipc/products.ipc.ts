import { ipcMain } from 'electron';
import { requirePermissionFromPayload } from './rbac';
import { logAudit } from '../db/queries'; // OJO: esto todavía audita en SQLITE
import {
  archiveProductRepo,
  listPosProductsRepo,
  listProductsRepo,
  updateProductRepo,
  upsertProductRepo,
  getProductByBarcodeRepo,
} from '../db/products.repo';

export const registerProductsIpc = (): void => {
  // ✅ Buscar producto por código de barras (para escáner)
  // Nombre del canal: 'products:by-barcode'
  ipcMain.removeHandler('products:by-barcode');

  ipcMain.handle('products:by-barcode', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');

    const barcode = String((payload as any)?.barcode ?? '').trim();
    if (!barcode) return null;

    return await getProductByBarcodeRepo(barcode);
  });

  // ✅ Lista de productos para el POS (búsqueda rápida)
  ipcMain.removeHandler('pos:products:list');
  ipcMain.handle('pos:products:list', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'pos:sell');
    const search = String((payload as any)?.search ?? '');
    return await listPosProductsRepo(search);
  });

  // ✅ Lista completa (inventario)
  ipcMain.removeHandler('products:list');
  ipcMain.handle('products:list', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'inventory:read');
    const search = String((payload as any)?.search ?? '');
    return await listProductsRepo(search);
  });

  // ✅ Crear / actualizar (upsert)
  ipcMain.removeHandler('products:save');
  ipcMain.handle('products:save', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'inventory:write');

    const product = (payload as any)?.product ?? payload;
    const id = await upsertProductRepo(product);

    const actorId = String((payload as any)?.userId ?? '');
    if (actorId) {
      try {
        logAudit({
          actorId,
          action: 'PRODUCT_SAVE',
          entityType: 'PRODUCT',
          entityId: id,
          metadata: {
            brand: product?.brand,
            model: product?.model,
            name: product?.name,
            barcode: product?.barcode,
          },
        });
      } catch {}
    }

    return id;
  });

  // ✅ Actualizar (update)
  ipcMain.removeHandler('products:update');
  ipcMain.handle('products:update', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'inventory:write');

    const productPayload = (payload as any)?.product ?? payload;
    const id = String(productPayload?.id ?? '').trim();
    if (!id) throw new Error('Missing product id');

    const product = await updateProductRepo(productPayload);

    const actorId = String((payload as any)?.userId ?? '');
    if (actorId) {
      try {
        logAudit({
          actorId,
          action: 'PRODUCT_UPDATE',
          entityType: 'PRODUCT',
          entityId: id,
          metadata: {
            stock: productPayload?.stock,
            sale_price: productPayload?.sale_price,
            barcode: productPayload?.barcode,
          },
        });
      } catch {}
    }

    return { ok: true, id, product };
  });

  // ✅ Archivar
  ipcMain.removeHandler('products:archive');
  ipcMain.handle('products:archive', async (_e, payload) => {
    requirePermissionFromPayload(payload, 'inventory:write');

    const id = String((payload as any)?.id ?? payload).trim();
    if (!id) throw new Error('Missing product id');

    await archiveProductRepo(id);

    const actorId = String((payload as any)?.userId ?? '');
    if (actorId) {
      try {
        logAudit({
          actorId,
          action: 'PRODUCT_DELETE',
          entityType: 'PRODUCT',
          entityId: id,
          metadata: { archived: true },
        });
      } catch {}
    }

    return true;
  });
};