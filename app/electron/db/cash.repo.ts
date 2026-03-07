import { isMySqlEnabled } from './dbRouter';
import { closeCash, getCashStatus, getOpenCash, getOpenSuggestion, openCash } from './queries'; // SQLite
import { closeCashMySql, getCashStatusMySql, getOpenCashMySql, getOpenSuggestionMySql, openCashMySql } from './mysql/cash.mysql';

export const openCashRepo = async (data: any): Promise<string> => {
  if (isMySqlEnabled()) return await openCashMySql(data);
  return openCash(data);
};

export const getOpenCashRepo = async (): Promise<any> => {
  if (isMySqlEnabled()) return await getOpenCashMySql();
  return getOpenCash();
};

export const getCashStatusRepo = async (): Promise<any> => {
  if (isMySqlEnabled()) return await getCashStatusMySql();
  return getCashStatus();
};

export const getOpenSuggestionRepo = async (): Promise<any> => {
  if (isMySqlEnabled()) return await getOpenSuggestionMySql();
  return getOpenSuggestion();
};

export const closeCashRepo = async (data: any): Promise<any> => {
  if (isMySqlEnabled()) return await closeCashMySql(data);
  return closeCash(data);
};