import { ipc } from './ipcClient';
import { getAuthContext } from './session';

export const createSale = (sale: unknown) =>
  ipc.sales.create({ ...getAuthContext(), sale });

export const printInvoice = (html: string) =>
  ipc.sales.printInvoice({ ...getAuthContext(), html });

export const suspendSale = (sale: unknown) =>
  ipc.sales.suspend({ ...getAuthContext(), sale });

export const listSuspendedSales = () =>
  ipc.sales.listSuspended({ ...getAuthContext() });

export const getSuspendedSale = (id: string) =>
  ipc.sales.getSuspended({ ...getAuthContext(), id });

export const deleteSuspendedSale = (id: string) =>
  ipc.sales.deleteSuspended({ ...getAuthContext(), id });

export const listRecentSales = (limit = 30) =>
  ipc.sales.listRecent({ ...getAuthContext(), limit });

export const getSaleDetail = (id: string) =>
  ipc.sales.getDetail({ ...getAuthContext(), id });

export const returnSale = (data: any) =>
  ipc.sales.return({ ...getAuthContext(), ...data });

export const createCreditNote = (data: {
  saleId: string;
  reasonCode: string;
  reasonText?: string;
  mode?: 'full' | 'partial';
  amount?: number;
}) =>
  ipc.sales.createCreditNote({ ...getAuthContext(), ...data });

export const createDebitNote = (data: {
  saleId: string;
  reasonCode: string;
  reasonText?: string;
  amount: number;
}) =>
  ipc.sales.createDebitNote({ ...getAuthContext(), ...data });

export const listElectronicEvents = (saleId: string) =>
  ipc.sales.listElectronicEvents({ ...getAuthContext(), saleId });