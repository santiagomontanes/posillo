import { isMySqlEnabled } from './dbRouter';
import { createSale } from './queries';
import { createSaleMySql, updateSaleElectronicInvoiceMySql } from './mysql/sales.mysql';

export const createSaleRepo = async (input: any): Promise<{ saleId: string; invoiceNumber: string }> => {
  if (isMySqlEnabled()) {
    return await createSaleMySql(input);
  }
  return createSale(input);
};

export const updateSaleElectronicInvoiceRepo = async (input: {
  saleId: string;
  factusStatus: string | null;
  factusBillId?: number | null;
  factusBillNumber?: string | null;
  factusPublicUrl?: string | null;
  factusCufe?: string | null;
  factusValidatedAt?: string | null;
  factusError?: string | null;
  factusRawJson?: string | null;
}): Promise<void> => {
  if (!isMySqlEnabled()) return;
  await updateSaleElectronicInvoiceMySql(input);
};