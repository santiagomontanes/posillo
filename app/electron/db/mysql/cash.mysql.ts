// app/electron/db/mysql/cash.mysql.ts
import { v4 as uuid } from 'uuid';
import { mysqlQuery, mysqlExec } from '../mysqlClient';

const pad = (n: number): string => String(n).padStart(2, '0');

const mysqlLocalDateTime = (value = new Date()): string => {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
};

const normalizeDbDateTime = (value: any): string => {
  if (!value) return mysqlLocalDateTime();

  if (value instanceof Date) {
    return mysqlLocalDateTime(value);
  }

  const s = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return s;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) {
    return s.slice(0, 19).replace('T', ' ');
  }

  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return mysqlLocalDateTime(d);
  }

  return mysqlLocalDateTime();
};

export const openCashMySql = async (data: {
  userId: string;
  openingCash: number;
  openingNotes?: string;
}): Promise<string> => {
  const alreadyOpen = await getOpenCashMySql();
  if (alreadyOpen) {
    throw new Error('Ya existe una caja abierta. Debes cerrarla antes de abrir una nueva.');
  }

  const id = uuid();
  const openedAt = mysqlLocalDateTime();

  await mysqlExec(
    `INSERT INTO cash_closures (id, opened_at, opened_by, opening_cash, opening_notes)
     VALUES (?, ?, ?, ?, ?)`,
    [
      id,
      openedAt,
      String(data.userId),
      Number(data.openingCash ?? 0),
      data.openingNotes ?? null,
    ],
  );

  return id;
};

export const getOpenCashMySql = async (): Promise<any> => {
  const rows = await mysqlQuery<any>(
    `SELECT
        id,
        DATE_FORMAT(opened_at, '%Y-%m-%d %H:%i:%s') AS opened_at,
        opened_by,
        opening_cash,
        opening_notes,
        DATE_FORMAT(closed_at, '%Y-%m-%d %H:%i:%s') AS closed_at,
        closed_by,
        counted_cash,
        expected_cash,
        total_sales,
        total_expenses,
        difference,
        notes
     FROM cash_closures
     WHERE closed_at IS NULL
     ORDER BY opened_at DESC
     LIMIT 1`,
    [],
  );

  return rows?.[0] ?? null;
};

export const getOpenSuggestionMySql = async (): Promise<any> => {
  const rows = await mysqlQuery<any>(
    `SELECT
        id,
        DATE_FORMAT(opened_at, '%Y-%m-%d %H:%i:%s') AS opened_at,
        DATE_FORMAT(closed_at, '%Y-%m-%d %H:%i:%s') AS closed_at,
        opening_cash,
        counted_cash,
        expected_cash
     FROM cash_closures
     WHERE closed_at IS NOT NULL
     ORDER BY closed_at DESC
     LIMIT 1`,
    [],
  );

  const last = rows?.[0];
  if (!last) {
    return {
      suggestedOpeningCash: null,
      lastClosedAt: null,
    };
  }

  const suggestedOpeningCash =
    last.counted_cash != null
      ? Number(last.counted_cash)
      : last.expected_cash != null
      ? Number(last.expected_cash)
      : last.opening_cash != null
      ? Number(last.opening_cash)
      : null;

  return {
    suggestedOpeningCash,
    lastClosedAt: last.closed_at ?? null,
  };
};

export const getCashStatusMySql = async (): Promise<any> => {
  const open = await getOpenCashMySql();
  if (!open) return null;

  const openedAt = normalizeDbDateTime(open.opened_at);
  const now = mysqlLocalDateTime();

  console.log('[CASH STATUS MYSQL]', {
  openId: open.id,
  rawOpenedAt: open.opened_at,
  openedAt,
  now,
});

  const cashSalesRows = await mysqlQuery<any>(
    `SELECT COALESCE(SUM(total),0) as total
     FROM sales
     WHERE created_at BETWEEN ? AND ?
       AND UPPER(TRIM(payment_method)) = ?`,
    [openedAt, now, 'EFECTIVO'],
  );

  const expensesRows = await mysqlQuery<any>(
    `SELECT COALESCE(SUM(amount),0) as total
     FROM expenses
     WHERE created_at BETWEEN ? AND ?`,
    [openedAt, now],
  ).catch(async () => {
    return await mysqlQuery<any>(
      `SELECT COALESCE(SUM(amount),0) as total
       FROM expenses
       WHERE date BETWEEN ? AND ?`,
      [openedAt, now],
    );
  });

  const returnsRows = await mysqlQuery<any>(
    `SELECT COALESCE(SUM(sr.total_returned),0) as total
     FROM sale_returns sr
     JOIN sales s ON s.id = sr.sale_id
     WHERE sr.created_at BETWEEN ? AND ?
       AND UPPER(TRIM(s.payment_method)) = ?`,
    [openedAt, now, 'EFECTIVO'],
  );

  const cashSales = Number(cashSalesRows?.[0]?.total ?? 0);
  const expenses = Number(expensesRows?.[0]?.total ?? 0);
  const cashReturns = Number(returnsRows?.[0]?.total ?? 0);
  const openingCash = Number(open.opening_cash ?? 0);

  const expectedCash = openingCash + cashSales - expenses - cashReturns;

  return {
    id: open.id,
    openedAt: open.opened_at,
    openingCash,
    cashSales,
    expenses,
    cashReturns,
    expectedCash,
  };
};

export const closeCashMySql = async (data: {
  id: string;
  countedCash: number;
  userId: string;
  notes: string;
}): Promise<any> => {
  const rows = await mysqlQuery<any>(
  `SELECT
      id,
      DATE_FORMAT(opened_at, '%Y-%m-%d %H:%i:%s') AS opened_at,
      opened_by,
      opening_cash,
      opening_notes,
      DATE_FORMAT(closed_at, '%Y-%m-%d %H:%i:%s') AS closed_at,
      closed_by,
      counted_cash,
      expected_cash,
      total_sales,
      total_expenses,
      difference,
      notes
   FROM cash_closures
   WHERE id = ?
   LIMIT 1`,
  [String(data.id)],
);

  const cash = rows?.[0];
  if (!cash) throw new Error('Caja no encontrada.');
  if (cash.closed_at) throw new Error('Esta caja ya fue cerrada.');

  const openedAt = normalizeDbDateTime(cash.opened_at);
  const closedAt = mysqlLocalDateTime();

  const salesRows = await mysqlQuery<any>(
    `SELECT
        COALESCE(SUM(total),0) as total,
        COALESCE(SUM(CASE WHEN UPPER(TRIM(payment_method)) = ? THEN total ELSE 0 END),0) as cashSales
     FROM sales
     WHERE created_at BETWEEN ? AND ?`,
    ['EFECTIVO', openedAt, closedAt],
  );

  const expensesRows = await mysqlQuery<any>(
    `SELECT COALESCE(SUM(amount),0) as total
     FROM expenses
     WHERE created_at BETWEEN ? AND ?`,
    [openedAt, closedAt],
  ).catch(async () => {
    return await mysqlQuery<any>(
      `SELECT COALESCE(SUM(amount),0) as total
       FROM expenses
       WHERE date BETWEEN ? AND ?`,
      [openedAt, closedAt],
    );
  });

  const returnsRows = await mysqlQuery<any>(
    `SELECT COALESCE(SUM(sr.total_returned),0) as total
     FROM sale_returns sr
     JOIN sales s ON s.id = sr.sale_id
     WHERE sr.created_at BETWEEN ? AND ?
       AND UPPER(TRIM(s.payment_method)) = ?`,
    [openedAt, closedAt, 'EFECTIVO'],
  );

  const totalSales = Number(salesRows?.[0]?.total ?? 0);
  const cashSales = Number(salesRows?.[0]?.cashSales ?? 0);
  const totalExpenses = Number(expensesRows?.[0]?.total ?? 0);
  const cashReturns = Number(returnsRows?.[0]?.total ?? 0);

  const openingCash = Number(cash.opening_cash ?? 0);
  const expectedCash = openingCash + cashSales - totalExpenses - cashReturns;
  const diff = Number(data.countedCash ?? 0) - expectedCash;

  await mysqlExec(
    `UPDATE cash_closures
     SET closed_at = ?, closed_by = ?, counted_cash = ?, expected_cash = ?,
         total_sales = ?, total_expenses = ?, difference = ?, notes = ?
     WHERE id = ? AND closed_at IS NULL`,
    [
      closedAt,
      String(data.userId),
      Number(data.countedCash ?? 0),
      expectedCash,
      totalSales,
      totalExpenses,
      diff,
      data.notes ?? '',
      String(data.id),
    ],
  );

  return {
    id: String(data.id),
    openedAt: cash.opened_at,
    closedAt,
    openingCash,
    expectedCash,
    countedCash: Number(data.countedCash ?? 0),
    totalSales,
    cashSales,
    totalExpenses,
    cashReturns,
    diff,
  };
};