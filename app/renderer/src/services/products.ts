import { ipc } from './ipcClient';
import { getAuthContext } from './session';

export const listProducts = (q = '') =>
  ipc.products.list({ ...getAuthContext(), search: q });

export const listPosProducts = (q = '') =>
  ipc.products.listForPos({ ...getAuthContext(), search: q });

// ✅ USAR byBarcode (canal products:by-barcode) + auth context
export const getProductByBarcode = (barcode: string) =>
  ipc.products.byBarcode({ ...getAuthContext(), barcode });

export const saveProduct = (p: unknown) =>
  ipc.products.save({ ...getAuthContext(), product: p });

export const updateProduct = (p: unknown) => {
  if (import.meta.env.DEV) console.debug('[products:update] payload', p);
  return ipc.products.update({ ...getAuthContext(), product: p });
};

export const archiveProduct = (id: string) =>
  ipc.products.archive({ ...getAuthContext(), id });