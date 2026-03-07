import { ipc } from './ipcClient';
import { getAuthContext } from './session';

export const createSale = (p: unknown) => ipc.sales.create({ ...getAuthContext(), sale: p });
export const printInvoice = (html: string) => ipc.sales.printInvoice({ ...getAuthContext(), html });
