import { isMySqlEnabled } from './dbRouter';
import { createSale } from './queries'; // SQLite
import { createSaleMySql } from './mysql/sales.mysql';

export const createSaleRepo = async (input: any): Promise<{ saleId: string; invoiceNumber: string }> => {
  if (isMySqlEnabled()) {
    return await createSaleMySql(input);
  }
  return createSale(input);
};