// app/electron/db/mysql/reports.mysql.ts
import { mysqlQueryAll } from '../mysql';

// -------------------- Helpers --------------------

const ymd = (s: string) => String(s ?? '').trim().slice(0, 10);

const localYmd = (d = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// -------------------- REPORTES --------------------

export const reportSalesByDayMySql = async (from: string, to: string): Promise<any[]> => {
  const f = ymd(from);
  const t = ymd(to);

  return await mysqlQueryAll<any>(
    `SELECT LEFT(date,10) as day, COALESCE(SUM(total),0) as total
     FROM sales
     WHERE LEFT(date,10) BETWEEN ? AND ?
     GROUP BY LEFT(date,10)
     ORDER BY day`,
    [f, t],
  );
};

export const reportTopProductsMySql = async (from: string, to: string): Promise<any[]> => {
  const f = ymd(from);
  const t = ymd(to);

  return await mysqlQueryAll<any>(
    `SELECT
       COALESCE(
         NULLIF(TRIM(IFNULL(p.name,'')), ''),
         NULLIF(TRIM(CONCAT(IFNULL(p.brand,''),' ',IFNULL(p.model,''))), ''),
         'Producto'
       ) AS name,
       COALESCE(SUM(si.qty),0) - COALESCE(SUM(sri.qty),0) AS qty
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN products p ON p.id = si.product_id
     LEFT JOIN sale_return_items sri ON sri.sale_item_id = si.id
     LEFT JOIN sale_returns sr ON sr.id = sri.return_id
     WHERE LEFT(s.date,10) BETWEEN ? AND ?
       AND si.product_id IS NOT NULL
     GROUP BY si.product_id, name
     HAVING qty > 0
     ORDER BY qty DESC
     LIMIT 10`,
    [f, t],
  );
};

export const reportSummaryMySql = async (from: string, to: string): Promise<any> => {
  const f = ymd(from);
  const t = ymd(to);

  const rows = await mysqlQueryAll<any>(
    `SELECT
       /* ventas brutas */
       (SELECT COALESCE(SUM(total),0)
          FROM sales
         WHERE LEFT(date,10) BETWEEN ? AND ?
       ) as total_sales,

       /* devoluciones */
       (SELECT COALESCE(SUM(sr.total_returned),0)
          FROM sale_returns sr
         WHERE LEFT(sr.created_at,10) BETWEEN ? AND ?
       ) as total_returns,

       /* gastos */
       (SELECT COALESCE(SUM(amount),0)
          FROM expenses
         WHERE LEFT(date,10) BETWEEN ? AND ?
       ) as total_expenses,

       /* costo bruto vendido */
       (SELECT COALESCE(SUM(si.qty * COALESCE(si.unit_cost, p.purchase_price, 0)),0)
          FROM sale_items si
          JOIN sales s ON s.id = si.sale_id
          LEFT JOIN products p ON p.id = si.product_id
         WHERE LEFT(s.date,10) BETWEEN ? AND ?
       ) as gross_costs,

       /* costo devuelto */
       (SELECT COALESCE(SUM(sri.qty * COALESCE(si.unit_cost, p.purchase_price, 0)),0)
          FROM sale_return_items sri
          JOIN sale_returns sr ON sr.id = sri.return_id
          JOIN sale_items si ON si.id = sri.sale_item_id
          LEFT JOIN products p ON p.id = sri.product_id
         WHERE LEFT(sr.created_at,10) BETWEEN ? AND ?
       ) as returned_costs`,
    [f, t, f, t, f, t, f, t, f, t],
  );

  const r = rows?.[0] ?? {
    total_sales: 0,
    total_returns: 0,
    total_expenses: 0,
    gross_costs: 0,
    returned_costs: 0,
  };

  const totalSales = num(r.total_sales);
  const totalReturns = num(r.total_returns);
  const totalExpenses = num(r.total_expenses);
  const grossCosts = num(r.gross_costs);
  const returnedCosts = num(r.returned_costs);

  const netSales = totalSales - totalReturns;
  const totalCosts = grossCosts - returnedCosts;
  const utility = netSales - totalCosts - totalExpenses;

  return {
    total_sales: totalSales,
    total_returns: totalReturns,
    net_sales: netSales,
    total_expenses: totalExpenses,
    total_costs: totalCosts,
    utility,
  };
};

export const getTodaySummaryMySql = async (): Promise<any> => {
  const today = localYmd(new Date());

  const rows = await mysqlQueryAll<any>(
    `SELECT
       /* ventas brutas */
       (SELECT COALESCE(SUM(total),0)
          FROM sales
         WHERE LEFT(date,10) = ?
       ) as total_sales,

       /* ventas en efectivo */
       (SELECT COALESCE(SUM(total),0)
          FROM sales
         WHERE LEFT(date,10) = ?
           AND UPPER(TRIM(payment_method)) = 'EFECTIVO'
       ) as cash_sales,

       /* devoluciones */
       (SELECT COALESCE(SUM(sr.total_returned),0)
          FROM sale_returns sr
         WHERE LEFT(sr.created_at,10) = ?
       ) as total_returns,

       /* devoluciones en efectivo */
       (SELECT COALESCE(SUM(sr.total_returned),0)
          FROM sale_returns sr
          JOIN sales s ON s.id = sr.sale_id
         WHERE LEFT(sr.created_at,10) = ?
           AND UPPER(TRIM(s.payment_method)) = 'EFECTIVO'
       ) as cash_returns,

       /* gastos */
       (SELECT COALESCE(SUM(amount),0)
          FROM expenses
         WHERE LEFT(date,10) = ?
       ) as total_expenses,

       /* costo bruto vendido */
       (SELECT COALESCE(SUM(si.qty * COALESCE(si.unit_cost, p.purchase_price, 0)),0)
          FROM sale_items si
          JOIN sales s ON s.id = si.sale_id
          LEFT JOIN products p ON p.id = si.product_id
         WHERE LEFT(s.date,10) = ?
       ) as gross_costs,

       /* costo devuelto */
       (SELECT COALESCE(SUM(sri.qty * COALESCE(si.unit_cost, p.purchase_price, 0)),0)
          FROM sale_return_items sri
          JOIN sale_returns sr ON sr.id = sri.return_id
          JOIN sale_items si ON si.id = sri.sale_item_id
          LEFT JOIN products p ON p.id = sri.product_id
         WHERE LEFT(sr.created_at,10) = ?
       ) as returned_costs`,
    [today, today, today, today, today, today, today],
  );

  const r = rows?.[0] ?? {
    total_sales: 0,
    cash_sales: 0,
    total_returns: 0,
    cash_returns: 0,
    total_expenses: 0,
    gross_costs: 0,
    returned_costs: 0,
  };

  const totalSales = num(r.total_sales);
  const cashSales = num(r.cash_sales);
  const totalReturns = num(r.total_returns);
  const cashReturns = num(r.cash_returns);
  const totalExpenses = num(r.total_expenses);
  const grossCosts = num(r.gross_costs);
  const returnedCosts = num(r.returned_costs);

  const netSales = totalSales - totalReturns;
  const totalCosts = grossCosts - returnedCosts;
  const utility = netSales - totalCosts - totalExpenses;

  return {
    day: today,
    total_sales: totalSales,
    cash_sales: cashSales,
    total_returns: totalReturns,
    cash_returns: cashReturns,
    net_sales: netSales,
    total_expenses: totalExpenses,
    total_costs: totalCosts,
    utility,
  };
};

export const getLast7DaysSalesMySql = async (): Promise<any[]> => {
  const now = new Date();
  const to = localYmd(now);

  const fromD = new Date(now);
  fromD.setDate(now.getDate() - 6);
  const from = localYmd(fromD);

  return await mysqlQueryAll<any>(
    `SELECT LEFT(date,10) as day, COALESCE(SUM(total),0) as total
     FROM sales
     WHERE LEFT(date,10) BETWEEN ? AND ?
     GROUP BY LEFT(date,10)
     ORDER BY day`,
    [from, to],
  );
};

export const reportDailyCloseMySql = async (from: string, to: string) => {
  const f = ymd(from);
  const t = ymd(to);

  const rows = await mysqlQueryAll<{ payment_method: string; total: any }>(
    `SELECT payment_method, COALESCE(SUM(total),0) as total
     FROM sales
     WHERE LEFT(date,10) BETWEEN ? AND ?
     GROUP BY payment_method`,
    [f, t],
  );

  const totalsByMethod: Record<string, number> = {};
  let totalSales = 0;

  for (const r of rows ?? []) {
    const pm = String((r as any)?.payment_method ?? 'OTRO').trim() || 'OTRO';
    const v = num((r as any)?.total);
    totalsByMethod[pm] = num(totalsByMethod[pm]) + v;
    totalSales += v;
  }

  const returnRows = await mysqlQueryAll<{ total_returns: any }>(
    `SELECT COALESCE(SUM(sr.total_returned),0) as total_returns
     FROM sale_returns sr
     WHERE LEFT(sr.created_at,10) BETWEEN ? AND ?`,
    [f, t],
  );
  const totalReturns = num((returnRows?.[0] as any)?.total_returns);

  const grossProfitRows = await mysqlQueryAll<{ profit: any }>(
    `SELECT COALESCE(SUM(si.line_total - (COALESCE(si.unit_cost,0) * si.qty)),0) as profit
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE LEFT(s.date,10) BETWEEN ? AND ?
       AND si.product_id IS NOT NULL`,
    [f, t],
  );
  const grossProfit = num((grossProfitRows?.[0] as any)?.profit);

  const returnedProfitRows = await mysqlQueryAll<{ returned_profit: any }>(
    `SELECT COALESCE(SUM(sri.line_total - (COALESCE(si.unit_cost,0) * sri.qty)),0) as returned_profit
     FROM sale_return_items sri
     JOIN sale_returns sr ON sr.id = sri.return_id
     JOIN sale_items si ON si.id = sri.sale_item_id
     WHERE LEFT(sr.created_at,10) BETWEEN ? AND ?
       AND sri.product_id IS NOT NULL`,
    [f, t],
  );
  const returnedProfit = num((returnedProfitRows?.[0] as any)?.returned_profit);

  const expRows = await mysqlQueryAll<{ total_expenses: any }>(
    `SELECT COALESCE(SUM(amount),0) as total_expenses
     FROM expenses
     WHERE LEFT(date,10) BETWEEN ? AND ?`,
    [f, t],
  );
  const totalExpenses = num((expRows?.[0] as any)?.total_expenses);

  const netSales = totalSales - totalReturns;
  const profit = grossProfit - returnedProfit;
  const net = profit - totalExpenses;
  const cashSales = num(totalsByMethod['EFECTIVO'] ?? 0);

  return {
    from: f,
    to: t,
    totalSales,
    totalReturns,
    netSales,
    cashSales,
    totalsByMethod,
    profit,
    totalExpenses,
    net,
  };
};