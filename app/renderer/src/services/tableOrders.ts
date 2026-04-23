import { getAuthContext } from './session';

export const listTableOrders = () =>
  window.api.tableOrders.list({ ...getAuthContext() });

export const createTableOrder = (tableName: string) =>
  window.api.tableOrders.create({ ...getAuthContext(), tableName });

export const getTableOrder = (id: string) =>
  window.api.tableOrders.get({ ...getAuthContext(), id });

export const saveTableOrder = (data: {
  id: string;
  tableName?: string;
  items: any[];
  total: number;
}) =>
  window.api.tableOrders.save({ ...getAuthContext(), ...data });

export const closeTableOrder = (id: string) =>
  window.api.tableOrders.close({ ...getAuthContext(), id });
