// app/electron/db/reports.repo.ts
import { getDbMode } from './db'; // ✅ AJUSTA la ruta si tu getDbMode está en otro archivo
// (En tu main.ts tú importas getDb/getDbMode de './db/db', por eso lo pongo así)

import {
  getLast7DaysSales,
  getTodaySummary,
  reportSalesByDay,
  reportSummary,
  reportTopProducts,
  reportDailyClose, // ✅ SQLite (queries.ts)
} from './queries';

import {
  getLast7DaysSalesMySql,
  getTodaySummaryMySql,
  reportSalesByDayMySql,
  reportSummaryMySql,
  reportTopProductsMySql,
  reportDailyCloseMySql, // ✅ MySQL
} from './mysql/reports.mysql';

const ymd = (s: any) => String(s ?? '').trim().slice(0, 10);

export const reportSalesByDayRepo = async (from: string, to: string) => {
  const mode = await getDbMode();
  if (mode === 'mysql') return await reportSalesByDayMySql(from, to);
  return reportSalesByDay(from, to);
};

export const reportTopProductsRepo = async (from: string, to: string) => {
  const mode = await getDbMode();
  if (mode === 'mysql') return await reportTopProductsMySql(from, to);
  return reportTopProducts(from, to);
};

export const reportSummaryRepo = async (from: string, to: string) => {
  const mode = await getDbMode();
  if (mode === 'mysql') return await reportSummaryMySql(from, to);
  return reportSummary(from, to);
};

export const getTodaySummaryRepo = async () => {
  const mode = await getDbMode();
  if (mode === 'mysql') return await getTodaySummaryMySql();
  return getTodaySummary();
};

export const getLast7DaysSalesRepo = async () => {
  const mode = await getDbMode();
  if (mode === 'mysql') return await getLast7DaysSalesMySql();
  return getLast7DaysSales();
};

// ✅ Cierre diario
export const reportDailyCloseRepo = async (from: string, to: string) => {
  const mode = await getDbMode();

  const f = ymd(from);
  const t = ymd(to || from);

  if (mode === 'mysql') {
    return await reportDailyCloseMySql(f, t);
  }

  // SQLite: tu queries.ts espera 2 args
  return await reportDailyClose(f, t);
};